import "server-only";
import { z } from "zod";
import pLimit from "p-limit";
import { encodeGitHubSegment, isSafeGitHubRef } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";
import type { ActivityDay, AuditReportDto, ContributorStat, LanguageSlice, RepoFile, RepositoryChecks } from "@/shared/contracts/audit";
import type { RepositoryDto } from "@/shared/contracts/repository";
import { computeHealth, type HealthCheck } from "@/lib/health";
import { detectManifests, hasTestSignals, type DetectedManifest } from "@/lib/dependencies";
import { isBinaryPath, languageColor, languageFromPath } from "@/lib/language";
import { scanFiles, summarizeFindings } from "@/lib/secret-rules";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";

const maxFiles = 400;
const maxDownloadBytes = 4_000_000;
const maxFileBytes = 512_000;
const maxContributors = 12;
const maxLanguages = 10;
const maxRecommendations = 8;
const maxCommitPages = 2;
const activityDays = 365;
const ninetyDaysMs = 90 * 86_400_000;
const yearMs = 365 * 86_400_000;

const treeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string(), size: z.number().nullable().optional(), sha: z.string() })),
  truncated: z.boolean().optional()
});

const contributorsSchema = z.array(z.object({
  login: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  contributions: z.number()
}));

const commitSchema = z.object({
  sha: z.string().optional(),
  commit: z.object({
    author: z.object({ date: z.string() }).nullable().optional(),
    committer: z.object({ date: z.string() }).nullable().optional()
  }).optional()
});
const commitsSchema = z.array(commitSchema);

type TreeBlob = z.infer<typeof treeSchema>["tree"][number];
type ContributorRow = z.infer<typeof contributorsSchema>[number];
type CommitRow = z.infer<typeof commitsSchema>[number];

const ignoredSegments = /(^|\/)(node_modules|vendor|dist|build|\.next|coverage)(\/|$)/i;
const lockFiles = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "cargo.lock", "go.sum"]);

export type AuditServiceReport = AuditReportDto & { textFiles: number };

export class AuditService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async audit(owner: string, repo: string, ref?: string): Promise<AuditServiceReport> {
    if (ref !== undefined && !isSafeGitHubRef(ref)) throw new AppError("VALIDATION_ERROR", "Invalid Git reference.", 400, false, { ref: "Invalid ref" });
    const repository = await this.repositories.detail(owner, repo);
    const targetRef = ref ?? repository.defaultBranch;
    const base = `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}`;
    try {
      const treeResult = await this.github.request({
        path: `${base}/git/trees/${encodeURIComponent(targetRef)}`,
        query: { recursive: 1 },
        schema: treeSchema,
        endpointTemplate: "/repos/{owner}/{repo}/git/trees/{ref}"
      });
      const blobs = treeResult.data.tree.filter((entry) => entry.type === "blob");
      const fileCount = blobs.length;
      const totalBytes = blobs.reduce((total, blob) => total + (blob.size ?? 0), 0);
      let truncated = Boolean(treeResult.data.truncated);
      const selected: TreeBlob[] = [];
      let budget = maxDownloadBytes;
      for (const blob of blobs.filter(scannable)) {
        if (selected.length >= maxFiles) { truncated = true; break; }
        const size = blob.size ?? 0;
        if (size > budget) { truncated = true; continue; }
        budget -= size;
        selected.push(blob);
      }
      const limit = pLimit(6);
      const downloads = Promise.all(selected.map((blob) => limit(async (): Promise<RepoFile | null> => {
        try {
          const result = await this.github.request({
            path: `${base}/contents/${blob.path.split("/").map(encodeURIComponent).join("/")}`,
            query: { ref: targetRef },
            schema: z.string(),
            accept: "application/vnd.github.raw+json",
            endpointTemplate: "/repos/{owner}/{repo}/contents/{path}"
          });
          return { path: blob.path, content: result.data };
        } catch (error) {
          if (error instanceof GitHubApiError && (error.details.status === 404 || (error.details.status === 403 && error.details.remaining !== 0))) return null;
          throw error;
        }
      })));
      const [downloaded, contributors, commitStats] = await Promise.all([downloads, this.contributors(base), this.commitActivity(base, targetRef)]);
      const files = downloaded.filter((file): file is RepoFile => file !== null && !file.content.includes("\u0000"));
      if (commitStats.morePages) truncated = true;
      const findings = scanFiles(files);
      const summary = summarizeFindings(findings);
      const manifests = detectManifests(files);
      const checks = buildChecks(repository, blobs, files, manifests);
      const health = computeHealth({
        description: repository.description,
        hasReadme: checks.readme.exists,
        hasLicense: checks.license !== null,
        hasContributing: checks.contributing,
        hasCodeOfConduct: checks.codeOfConduct,
        hasSecurityPolicy: checks.securityPolicy,
        hasCi: checks.ci.length > 0,
        hasTests: checks.tests,
        hasChangelog: checks.changelog,
        dependencyManifests: manifests.length,
        topics: repository.topics.length,
        contributors: contributors.length,
        commitsLast90Days: commitStats.commitsLast90Days,
        criticalFindings: summary.bySeverity.critical,
        highFindings: summary.bySeverity.high,
        archived: repository.archived
      });
      return {
        generatedAt: new Date().toISOString(),
        fileCount,
        totalBytes,
        truncated,
        commitsScanned: commitStats.commitsScanned,
        checks,
        health,
        secrets: { findings, summary },
        languages: languageSlices(blobs, repository.language),
        contributors,
        activity: commitStats.activity,
        manifests,
        recommendations: buildRecommendations(health.improvements, summary),
        textFiles: files.length
      };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "AUDIT_FAILED");
      throw error;
    }
  }

  private async contributors(base: string): Promise<ContributorStat[]> {
    let rows: ContributorRow[];
    try {
      const result = await this.github.request({
        path: `${base}/contributors`,
        query: { per_page: 100 },
        schema: contributorsSchema,
        endpointTemplate: "/repos/{owner}/{repo}/contributors"
      });
      rows = result.data;
    } catch (error) {
      if (error instanceof z.ZodError) return [];
      if (error instanceof GitHubApiError && (error.details.status === 404 || error.details.status === 409 || error.details.status === 422)) return [];
      throw error;
    }
    const total = rows.reduce((sum, row) => sum + row.contributions, 0);
    return rows.slice()
      .sort((left, right) => right.contributions - left.contributions)
      .slice(0, maxContributors)
      .map((row) => ({
        login: row.login ?? "anonymous",
        avatarUrl: row.avatar_url ?? null,
        commits: row.contributions,
        percent: total > 0 ? Math.round((row.contributions / total) * 100) : 0
      }));
  }

  private async commitActivity(base: string, ref: string): Promise<{ commitsScanned: number; commitsLast90Days: number; activity: ActivityDay[]; morePages: boolean }> {
    const since = new Date(Date.now() - yearMs).toISOString();
    const cutoff = Date.now() - ninetyDaysMs;
    const dayCounts = new Map<string, number>();
    let commitsScanned = 0;
    let commitsLast90Days = 0;
    let morePages = false;
    for (let page = 1; page <= maxCommitPages; page += 1) {
      const result = await this.commitsPage(base, ref, since, page);
      if (!result) break;
      commitsScanned += result.data.length;
      for (const commit of result.data) {
        const iso = commitDate(commit);
        if (!iso) continue;
        const timestamp = Date.parse(iso);
        if (!Number.isFinite(timestamp)) continue;
        const date = new Date(timestamp).toISOString().slice(0, 10);
        dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
        if (timestamp >= cutoff) commitsLast90Days += 1;
      }
      if (!result.links.next) break;
      if (page === maxCommitPages) morePages = true;
    }
    return { commitsScanned, commitsLast90Days, activity: buildActivity(dayCounts), morePages };
  }

  private async commitsPage(base: string, ref: string, since: string, page: number) {
    try {
      return await this.github.request({
        path: `${base}/commits`,
        query: { sha: ref, since, per_page: 100, page },
        schema: commitsSchema,
        endpointTemplate: "/repos/{owner}/{repo}/commits"
      });
    } catch (error) {
      if (error instanceof GitHubApiError && (error.details.status === 404 || error.details.status === 409 || error.details.status === 422)) return null;
      throw error;
    }
  }
}

function commitDate(commit: CommitRow): string | null {
  return commit.commit?.committer?.date ?? commit.commit?.author?.date ?? null;
}

function scannable(blob: TreeBlob): boolean {
  const size = blob.size;
  if (typeof size !== "number" || size <= 0 || size > maxFileBytes) return false;
  if (ignoredSegments.test(blob.path)) return false;
  const name = blob.path.split("/").pop()?.toLowerCase() ?? "";
  if (lockFiles.has(name) || name.endsWith(".min.js")) return false;
  if (isBinaryPath(blob.path)) return false;
  if (!name.includes(".") && !languageFromPath(blob.path)) return false;
  return true;
}

function buildActivity(counts: Map<string, number>): ActivityDay[] {
  const days: ActivityDay[] = [];
  const now = new Date();
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let offset = activityDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * 86_400_000).toISOString().slice(0, 10);
    days.push({ date, count: counts.get(date) ?? 0 });
  }
  return days;
}

function buildChecks(repository: RepositoryDto, blobs: TreeBlob[], files: RepoFile[], manifests: DetectedManifest[]): RepositoryChecks {
  const paths = blobs.map((blob) => blob.path);
  const readme = blobs.find((blob) => /^readme(\.|$)/i.test(blob.path));
  const licenseFile = paths.find((path) => /(^|\/)(licen[cs]e|copying)(\.|$)/i.test(path));
  const contents = new Map(files.map((file) => [file.path, file.content]));
  const ci = paths.filter((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path));
  return {
    readme: { exists: Boolean(readme), path: readme?.path ?? null, bytes: readme?.size ?? 0 },
    license: repository.license ?? licenseFile ?? null,
    changelog: paths.some((path) => /(^|\/)changelog(\.|$)/i.test(path)),
    contributing: paths.some((path) => /(^|\/)contributing(\.|$)/i.test(path)),
    codeOfConduct: paths.some((path) => /(^|\/)code[_-]?of[_-]?conduct(\.|$)/i.test(path)),
    securityPolicy: paths.some((path) => /(^|\/)security(\.|$)/i.test(path)),
    ci,
    tests: hasTestSignals(paths, manifests),
    topics: repository.topics,
    archived: repository.archived,
    description: repository.description,
    defaultBranch: repository.defaultBranch,
    hasPagesWorkflow: ci.some((path) => {
      const content = contents.get(path);
      return Boolean(content && /pages|deploy-pages/i.test(content));
    }),
    hasDependabot: paths.some((path) => /^\.github\/dependabot\.ya?ml$/i.test(path))
  };
}

function languageSlices(blobs: TreeBlob[], fallback: string | null): LanguageSlice[] {
  const totals = new Map<string, { bytes: number; color: string }>();
  let total = 0;
  for (const blob of blobs) {
    const size = blob.size ?? 0;
    if (size <= 0) continue;
    total += size;
    const info = languageFromPath(blob.path);
    const name = info?.name ?? "Other";
    const entry = totals.get(name) ?? { bytes: 0, color: info?.color ?? "#5c6170" };
    entry.bytes += size;
    totals.set(name, entry);
  }
  if (total <= 0) return fallback ? [{ name: fallback, bytes: 0, percent: 100, color: languageColor(fallback) }] : [];
  return [...totals.entries()]
    .map(([name, entry]) => ({ name, bytes: entry.bytes, percent: Math.round((entry.bytes / total) * 100), color: entry.color }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, maxLanguages);
}

function buildRecommendations(improvements: HealthCheck[], summary: ReturnType<typeof summarizeFindings>): AuditReportDto["recommendations"] {
  const recommendations: AuditReportDto["recommendations"] = [];
  if (summary.total > 0) {
    recommendations.push({
      id: "secret-rotation",
      title: "Rotate exposed credentials",
      detail: `${summary.total} potential secret${summary.total === 1 ? "" : "s"} found across ${summary.affectedFiles} file${summary.affectedFiles === 1 ? "" : "s"}. Rotate the credentials first, then remove them from the repository history.`,
      severity: summary.bySeverity.critical > 0 || summary.bySeverity.high > 0 ? "high" : "medium",
      category: "security"
    });
  }
  for (const check of improvements) {
    recommendations.push({
      id: check.id,
      title: check.label,
      detail: check.action ?? check.detail,
      severity: check.weight >= 10 ? "high" : check.weight >= 5 ? "medium" : "low",
      category: check.category
    });
  }
  const rank: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((left, right) => rank[left.severity] - rank[right.severity]).slice(0, maxRecommendations);
}
