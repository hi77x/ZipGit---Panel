import "server-only";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { repositorySchema, type RepositoryDto } from "@/shared/contracts/repository";
import { AppError } from "@/shared/contracts/api-error";
import type { CodeSearchResultDto, SearchResponseDto } from "@/shared/contracts/misc";

export type SearchTab = "repositories" | "code" | "issues";

const repositorySearchSchema = z.object({ total_count: z.number(), items: z.array(repositorySchema) });

const codeSearchSchema = z.object({
  total_count: z.number(),
  items: z.array(z.object({
    name: z.string(),
    path: z.string(),
    sha: z.string(),
    html_url: z.url(),
    score: z.number(),
    repository: repositorySchema
  }))
});

const issueSearchSchema = z.object({
  total_count: z.number(),
  items: z.array(z.object({
    number: z.number(),
    title: z.string(),
    state: z.string(),
    html_url: z.url(),
    repository_url: z.url()
  }))
});

type CodeSearchItem = z.infer<typeof codeSearchSchema>["items"][number];
type IssueSearchItem = z.infer<typeof issueSearchSchema>["items"][number];

export type SearchResult = SearchResponseDto & { page: number; hasNext: boolean };

export class SearchService {
  constructor(private readonly github: GitHubClient) {}

  async search(input: { query: string; tab: SearchTab; page: number }): Promise<SearchResult> {
    const query = input.query.trim();
    if (!query || query.length > 256) {
      throw new AppError("VALIDATION_ERROR", "Search queries must be between 1 and 256 characters.", 400, false, { q: "1-256 characters" });
    }
    const page = Math.max(1, input.page);
    try {
      if (input.tab === "code") {
        const result = await this.github.request({
          path: "/search/code",
          query: { q: query, page, per_page: 30 },
          schema: codeSearchSchema,
          accept: "application/vnd.github.text-match+json",
          endpointTemplate: "/search/code"
        });
        return { query, repositories: [], code: result.data.items.map(toCodeResult), issues: [], page, hasNext: Boolean(result.links.next) };
      }
      if (input.tab === "issues") {
        const result = await this.github.request({
          path: "/search/issues",
          query: { q: query, page, per_page: 30 },
          schema: issueSearchSchema,
          endpointTemplate: "/search/issues"
        });
        return { query, repositories: [], code: [], issues: result.data.items.map(toIssueResult), page, hasNext: Boolean(result.links.next) };
      }
      const result = await this.github.request({
        path: "/search/repositories",
        query: { q: query, page, per_page: 30 },
        schema: repositorySearchSchema,
        endpointTemplate: "/search/repositories"
      });
      return { query, repositories: result.data.items.map(mapRepository), code: [], issues: [], page, hasNext: Boolean(result.links.next) };
    } catch (error) {
      if (error instanceof GitHubApiError && (error.details.status === 403 || error.details.status === 422)) throw mapGitHubError(error, "SEARCH_FAILED");
      throw error;
    }
  }
}

function toCodeResult(item: CodeSearchItem): CodeSearchResultDto {
  return {
    path: item.path,
    name: item.name,
    sha: item.sha,
    url: item.html_url,
    repository: {
      fullName: item.repository.full_name,
      owner: item.repository.owner.login,
      name: item.repository.name,
      avatarUrl: item.repository.owner.avatar_url
    },
    score: item.score
  };
}

function toIssueResult(item: IssueSearchItem) {
  return {
    number: item.number,
    title: item.title,
    state: item.state,
    url: item.html_url,
    repository: { fullName: repositoryFullName(item.repository_url) }
  };
}

function repositoryFullName(repositoryUrl: string): string {
  const segments = repositoryUrl.split("/").filter(Boolean);
  const name = segments.at(-1);
  const owner = segments.at(-2);
  return owner && name ? `${owner}/${name}` : repositoryUrl;
}

function mapRepository(repo: z.infer<typeof repositorySchema>): RepositoryDto {
  return {
    id: repo.id, name: repo.name, owner: repo.owner.login, fullName: repo.full_name,
    visibility: repo.visibility ?? (repo.private ? "private" : "public"), description: repo.description,
    language: repo.language, stars: repo.stargazers_count, forks: repo.forks_count,
    watchers: repo.watchers_count ?? repo.stargazers_count, openIssues: repo.open_issues_count ?? 0,
    topics: repo.topics ?? [], archived: repo.archived ?? false, isFork: repo.fork ?? false,
    homepage: repo.homepage ?? null, sizeKb: repo.size ?? 0,
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : null,
    licenseName: repo.license?.name ?? null,
    createdAt: repo.created_at ?? null, pushedAt: repo.pushed_at ?? null,
    updatedAt: repo.updated_at, defaultBranch: repo.default_branch, url: repo.html_url, avatarUrl: repo.owner.avatar_url
  };
}
