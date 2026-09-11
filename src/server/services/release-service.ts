import "server-only";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";
import { requireCapability } from "@/server/authz/capabilities";
import { encodeGitHubSegment, isSafeGitHubRef } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";
import type { ReleaseDto } from "@/shared/contracts/misc";

const assetSchema = z.object({
  id: z.number(),
  name: z.string(),
  size: z.number(),
  download_count: z.number(),
  browser_download_url: z.url()
});

const releaseSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  name: z.string().nullable(),
  body: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  created_at: z.string(),
  published_at: z.string().nullable(),
  html_url: z.url(),
  tarball_url: z.string().nullable(),
  zipball_url: z.string().nullable(),
  author: z.object({ login: z.string(), avatar_url: z.string().nullable() }).nullable(),
  assets: z.array(assetSchema)
});

export const releaseCreateSchema = z.object({
  tagName: z.string().trim().min(1).max(200),
  name: z.string().trim().max(256).optional(),
  body: z.string().max(125_000).optional(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
  targetCommitish: z.string().trim().min(1).max(255).optional()
});

export const releaseUpdateSchema = releaseCreateSchema.partial();

export type ReleaseCreateInput = z.infer<typeof releaseCreateSchema>;
export type ReleaseUpdateInput = z.infer<typeof releaseUpdateSchema>;

export class ReleaseService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async list(owner: string, repo: string, page = 1) {
    await this.repositories.assertAccessible(owner, repo);
    const result = await this.github.request({
      path: this.base(owner, repo),
      query: { page, per_page: 30 },
      schema: z.array(releaseSchema),
      endpointTemplate: "/repos/{owner}/{repo}/releases"
    });
    return { releases: result.data.map(toRelease), page, hasNext: Boolean(result.links.next) };
  }

  async create(owner: string, repo: string, input: ReleaseCreateInput): Promise<ReleaseDto> {
    assertSafeTag(input.tagName);
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, "manageReleases");
    try {
      const result = await this.github.request({
        method: "POST",
        path: this.base(owner, repo),
        body: { tag_name: input.tagName, name: input.name, body: input.body, draft: input.draft, prerelease: input.prerelease, target_commitish: input.targetCommitish },
        schema: releaseSchema,
        endpointTemplate: "/repos/{owner}/{repo}/releases"
      });
      return toRelease(result.data);
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 422) throw mapGitHubError(error, "RELEASE_INVALID");
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "RELEASE_WRITE_PERMISSION_REQUIRED");
      throw error;
    }
  }

  async update(owner: string, repo: string, id: number, input: ReleaseUpdateInput): Promise<ReleaseDto> {
    assertReleaseId(id);
    if (input.tagName !== undefined) assertSafeTag(input.tagName);
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, "manageReleases");
    try {
      const result = await this.github.request({
        method: "PATCH",
        path: `${this.base(owner, repo)}/${id}`,
        body: { tag_name: input.tagName, name: input.name, body: input.body, draft: input.draft, prerelease: input.prerelease, target_commitish: input.targetCommitish },
        schema: releaseSchema,
        endpointTemplate: "/repos/{owner}/{repo}/releases/{id}"
      });
      return toRelease(result.data);
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw mapGitHubError(error, "RELEASE_NOT_FOUND");
      if (error instanceof GitHubApiError && error.details.status === 422) throw mapGitHubError(error, "RELEASE_INVALID");
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "RELEASE_WRITE_PERMISSION_REQUIRED");
      throw error;
    }
  }

  async remove(owner: string, repo: string, id: number): Promise<{ deleted: true }> {
    assertReleaseId(id);
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, "manageReleases");
    try {
      await this.github.request({ method: "DELETE", path: `${this.base(owner, repo)}/${id}`, schema: z.unknown(), endpointTemplate: "/repos/{owner}/{repo}/releases/{id}" });
      return { deleted: true };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw mapGitHubError(error, "RELEASE_NOT_FOUND");
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "RELEASE_WRITE_PERMISSION_REQUIRED");
      throw error;
    }
  }

  private base(owner: string, repo: string) {
    return `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/releases`;
  }
}

function assertReleaseId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError("RELEASE_NOT_FOUND", "Invalid release identifier.", 400);
}

function assertSafeTag(tag: string): void {
  if (!isSafeGitHubRef(tag)) throw new AppError("RELEASE_INVALID", "Choose a valid Git tag for the release.", 400, false, { tagName: "Invalid tag" });
}

function toRelease(release: z.infer<typeof releaseSchema>): ReleaseDto {
  return {
    id: release.id,
    tagName: release.tag_name,
    name: release.name ?? "",
    body: release.body ?? "",
    draft: release.draft,
    prerelease: release.prerelease,
    createdAt: release.created_at,
    publishedAt: release.published_at,
    url: release.html_url,
    tarballUrl: release.tarball_url,
    zipballUrl: release.zipball_url,
    author: release.author ? { login: release.author.login, avatarUrl: release.author.avatar_url } : null,
    assets: release.assets.map((asset) => ({ id: asset.id, name: asset.name, size: asset.size, downloadCount: asset.download_count, url: asset.browser_download_url }))
  };
}
