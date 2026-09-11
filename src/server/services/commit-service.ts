import "server-only";
import { z } from "zod";
import { encodeGitHubSegment, isSafeGitHubRef } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";
import type { CommitDto, CommitRefDto, CompareDto, FileDiffDto } from "@/shared/contracts/content";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";

const identitySchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  date: z.string().nullable().optional()
}).nullable().optional();

const userSchema = z.object({
  login: z.string().optional(),
  name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional()
}).nullable().optional();

const commitSchema = z.object({
  sha: z.string(),
  html_url: z.url().nullable().optional(),
  commit: z.object({ message: z.string(), author: identitySchema }),
  author: userSchema
});

const fileSchema = z.object({
  filename: z.string(),
  previous_filename: z.string().nullable().optional(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  patch: z.string().nullable().optional()
});

const commitDetailSchema = commitSchema.extend({
  stats: z.object({ additions: z.number(), deletions: z.number() }).nullable().optional(),
  parents: z.array(z.object({ sha: z.string() })).nullable().optional(),
  files: z.array(fileSchema).nullable().optional()
});

const compareSchema = z.object({
  status: z.enum(["ahead", "behind", "diverged", "identical"]),
  ahead_by: z.number(),
  behind_by: z.number(),
  total_commits: z.number(),
  files: z.array(fileSchema).nullable().optional(),
  commits: z.array(commitSchema).nullable().optional()
});

const maxCompareFiles = 300;

export type CommitListInput = { ref: string; page: number; perPage: number };

export class CommitService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async list(owner: string, repo: string, input: CommitListInput): Promise<{ commits: CommitRefDto[]; page: number; hasNext: boolean; ref: string }> {
    if (!isSafeGitHubRef(input.ref)) throw new AppError("VALIDATION_ERROR", "Invalid Git reference.", 400, false, { ref: "Invalid ref" });
    await this.repositories.assertAccessible(owner, repo);
    try {
      const result = await this.github.request({
        path: `${this.base(owner, repo)}/commits`,
        query: { sha: input.ref, page: input.page, per_page: Math.min(100, input.perPage) },
        schema: z.array(commitSchema),
        endpointTemplate: "/repos/{owner}/{repo}/commits"
      });
      return { commits: result.data.map(toCommitRef), page: input.page, hasNext: Boolean(result.links.next), ref: input.ref };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 409) return { commits: [], page: input.page, hasNext: false, ref: input.ref };
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
  }

  async detail(owner: string, repo: string, sha: string): Promise<CommitDto> {
    if (!isSafeGitHubRef(sha)) throw new AppError("VALIDATION_ERROR", "Invalid commit reference.", 400, false, { sha: "Invalid commit" });
    try {
      const result = await this.github.request({
        path: `${this.base(owner, repo)}/commits/${encodeURIComponent(sha)}`,
        schema: commitDetailSchema,
        endpointTemplate: "/repos/{owner}/{repo}/commits/{ref}"
      });
      return toCommit(result.data, owner, repo);
    } catch (error) {
      if (error instanceof GitHubApiError) throw mapGitHubError(error, "COMMIT_NOT_FOUND");
      throw error;
    }
  }

  async compare(owner: string, repo: string, base: string, head: string): Promise<CompareDto> {
    if (!isSafeGitHubRef(base) || !isSafeGitHubRef(head)) throw new AppError("VALIDATION_ERROR", "Invalid Git reference.", 400, false, { base: "Invalid base ref", head: "Invalid head ref" });
    await this.repositories.assertAccessible(owner, repo);
    try {
      const result = await this.github.request({
        path: `${this.base(owner, repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
        schema: compareSchema,
        endpointTemplate: "/repos/{owner}/{repo}/compare/{basehead}"
      });
      const files = (result.data.files ?? []).map(toFileDiff);
      return {
        status: result.data.status,
        aheadBy: result.data.ahead_by,
        behindBy: result.data.behind_by,
        totalCommits: result.data.total_commits,
        additions: files.reduce((total, file) => total + file.additions, 0),
        deletions: files.reduce((total, file) => total + file.deletions, 0),
        files: files.slice(0, maxCompareFiles),
        commits: (result.data.commits ?? []).map(toCommitRef)
      };
    } catch (error) {
      if (error instanceof GitHubApiError) throw mapGitHubError(error, "COMPARE_FAILED");
      throw error;
    }
  }

  private base(owner: string, repo: string): string {
    return `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}`;
  }
}

function toCommitRef(commit: z.infer<typeof commitSchema>): CommitRefDto {
  return {
    sha: commit.sha,
    message: commit.commit.message.split(/\r?\n/)[0] ?? "",
    authorLogin: commit.author?.login ?? null,
    authorName: commit.author?.name ?? commit.commit.author?.name ?? commit.author?.login ?? "Unknown author",
    authorAvatar: commit.author?.avatar_url ?? null,
    authoredAt: commit.commit.author?.date ?? null
  };
}

function toFileDiff(file: z.infer<typeof fileSchema>): FileDiffDto {
  const patch = file.patch ?? null;
  return {
    filename: file.filename,
    previousFilename: file.previous_filename ?? null,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch,
    binary: !patch && file.changes > 0,
    truncated: false
  };
}

function toCommit(commit: z.infer<typeof commitDetailSchema>, owner: string, repo: string): CommitDto {
  const files = (commit.files ?? []).map(toFileDiff);
  return {
    ...toCommitRef(commit),
    url: commit.html_url ?? `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit/${commit.sha}`,
    parents: (commit.parents ?? []).map((parent) => parent.sha),
    additions: commit.stats?.additions ?? files.reduce((total, file) => total + file.additions, 0),
    deletions: commit.stats?.deletions ?? files.reduce((total, file) => total + file.deletions, 0),
    files
  };
}
