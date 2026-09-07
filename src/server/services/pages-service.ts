import "server-only";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";
import { encodeGitHubSegment } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";

const pagesSchema = z.object({
  html_url: z.string().nullable().optional(), status: z.string().optional(), cname: z.string().nullable().optional(),
  protected_domain_state: z.string().nullable().optional(), https_enforced: z.boolean().optional(),
  build_type: z.string().optional(), source: z.object({ branch: z.string(), path: z.string() }).optional()
});
const buildSchema = z.object({ status: z.string().optional(), updated_at: z.string().optional(), error: z.object({ message: z.string().nullable().optional() }).optional() });

export class PagesService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async get(owner: string, repo: string) {
    await this.repositories.assertAccessible(owner, repo);
    const base = `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/pages`;
    try {
      const page = (await this.github.request({ path: base, schema: pagesSchema, endpointTemplate: "/repos/{owner}/{repo}/pages" })).data;
      let build: z.infer<typeof buildSchema> | null = null;
      try { build = (await this.github.request({ path: `${base}/builds/latest`, schema: buildSchema, endpointTemplate: "/repos/{owner}/{repo}/pages/builds/latest" })).data; }
      catch (error) { if (!(error instanceof GitHubApiError && error.details.status === 404)) throw error; }
      const status = page.html_url && (page.status === "built" || build?.status === "built") ? "deployed"
        : page.status === "building" || build?.status === "building" || build?.status === "queued" ? "building"
        : page.status === "errored" || build?.status === "errored" ? "failed" : "configured";
      return { status, url: page.html_url ?? null, source: page.source ?? null, mode: page.build_type ?? "legacy", customDomain: page.cname ?? null, httpsEnforced: page.https_enforced ?? false, updatedAt: build?.updated_at ?? null, error: build?.error?.message ?? null, branches: await this.repositories.branches(owner, repo, false) };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) return { status: "disabled" as const, branches: await this.repositories.branches(owner, repo, false) };
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "PAGES_PERMISSION_OR_PLAN_REQUIRED");
      throw error;
    }
  }

  async configure(owner: string, repo: string, input: { mode: "branch" | "workflow"; branch?: string; path?: "/" | "/docs" }, update = false) {
    const branches = await this.repositories.branches(owner, repo);
    if (input.mode === "branch" && (!input.branch || !branches.includes(input.branch) || !input.path)) {
      throw new AppError("PAGES_INVALID_SOURCE", "Choose an existing branch and / or /docs.", 400, false, { branch: "Invalid branch or folder" });
    }
    const body = input.mode === "workflow" ? { build_type: "workflow" } : { build_type: "legacy", source: { branch: input.branch, path: input.path } };
    const base = `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/pages`;
    try {
      await this.github.request({ method: update ? "PATCH" : "POST", path: base, body, schema: z.unknown(), endpointTemplate: "/repos/{owner}/{repo}/pages" });
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 422) {
        if (!update) return this.get(owner, repo);
        throw mapGitHubError(error, "PAGES_INVALID_SOURCE");
      }
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "PAGES_PERMISSION_OR_PLAN_REQUIRED");
      throw error;
    }
    return this.get(owner, repo);
  }

  async build(owner: string, repo: string) {
    await this.repositories.assertAccessible(owner, repo);
    try {
      await this.github.request({ method: "POST", path: `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/pages/builds`, schema: z.unknown(), endpointTemplate: "/repos/{owner}/{repo}/pages/builds" });
      return this.get(owner, repo);
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 422) throw mapGitHubError(error, "PAGES_BUILD_NOT_TRIGGERABLE");
      throw error;
    }
  }
}
