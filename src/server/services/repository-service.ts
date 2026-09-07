import "server-only";
import { z } from "zod";
import { encodeGitHubSegment } from "@/lib/url";
import { repositorySchema, type RepositoryDto } from "@/shared/contracts/repository";
import { AppError } from "@/shared/contracts/api-error";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";

const viewerSchema = z.object({
  id: z.number(), login: z.string(), name: z.string().nullable(), email: z.string().nullable(), avatar_url: z.url()
});
const branchSchema = z.object({ name: z.string() });

export class RepositoryService {
  constructor(private readonly github: GitHubClient) {}

  async viewer() {
    const result = await this.github.request({ path: "/user", schema: viewerSchema, endpointTemplate: "/user" });
    return { id: String(result.data.id), login: result.data.login, name: result.data.name, email: result.data.email, avatarUrl: result.data.avatar_url };
  }

  async list(input: { affiliation: string; sort: string; direction: string; page: number; perPage: number }) {
    const result = await this.github.request({
      path: "/user/repos",
      query: { affiliation: input.affiliation, sort: input.sort, direction: input.direction, page: input.page, per_page: input.perPage },
      schema: z.array(repositorySchema), endpointTemplate: "/user/repos"
    });
    return { repositories: result.data.map(toRepository), page: input.page, hasNext: Boolean(result.links.next) };
  }

  async detail(owner: string, repo: string): Promise<RepositoryDto> {
    const path = `/repos/${encodeGitHubSegment(owner, "owner")}/${encodeGitHubSegment(repo, "repository")}`;
    try {
      const result = await this.github.request({ path, schema: repositorySchema, endpointTemplate: "/repos/{owner}/{repo}" });
      return toRepository(result.data);
    } catch (error) {
      if (error instanceof GitHubApiError) throw mapGitHubError(error, "REPOSITORY_NOT_FOUND_OR_FORBIDDEN");
      throw error;
    }
  }

  async branches(owner: string, repo: string, assertAccessible = true) {
    if (assertAccessible) await this.detail(owner, repo);
    const path = `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/branches`;
    const result = await this.github.request({ path, query: { per_page: 100 }, schema: z.array(branchSchema), endpointTemplate: "/repos/{owner}/{repo}/branches" });
    return result.data.map(({ name }) => name);
  }

  async assertAccessible(owner: string, repo: string): Promise<void> {
    await this.detail(owner, repo);
  }
}

function toRepository(repo: z.infer<typeof repositorySchema>): RepositoryDto {
  return {
    id: repo.id, name: repo.name, owner: repo.owner.login, fullName: repo.full_name,
    visibility: repo.visibility ?? (repo.private ? "private" : "public"), description: repo.description,
    language: repo.language, stars: repo.stargazers_count, forks: repo.forks_count,
    updatedAt: repo.updated_at, defaultBranch: repo.default_branch, url: repo.html_url, avatarUrl: repo.owner.avatar_url
  };
}

export function validateRepositoryName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 100 || !/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === "..") {
    throw new AppError("INVALID_REPOSITORY_NAME", "Use 1–100 letters, numbers, dots, hyphens, or underscores.", 400, false, { repositoryName: "Invalid repository name" });
  }
  return name;
}
