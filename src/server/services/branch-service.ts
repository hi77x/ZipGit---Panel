import "server-only";
import { z } from "zod";
import { encodeGitHubSegment, isSafeGitHubRef } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";
import type { BranchDto } from "@/shared/contracts/content";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";

const branchSchema = z.object({
  name: z.string(),
  protected: z.boolean().optional(),
  commit: z.object({ sha: z.string() })
});

const refSchema = z.object({
  ref: z.string(),
  object: z.object({ sha: z.string() })
});

const commitSchema = z.object({ sha: z.string() });
const branchNamePattern = /^[A-Za-z0-9._/-]+$/;

export const createBranchSchema = z.object({
  name: z.string().min(1).max(255),
  from: z.string().min(1).max(255)
});

export class BranchService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async list(owner: string, repo: string) {
    const detail = await this.repositories.detail(owner, repo);
    const result = await this.github.request({
      path: `${this.base(owner, repo)}/branches`,
      query: { per_page: 100 },
      schema: z.array(branchSchema),
      endpointTemplate: "/repos/{owner}/{repo}/branches"
    });
    return { branches: result.data.map((branch) => toBranch(branch, detail.defaultBranch)), defaultBranch: detail.defaultBranch };
  }

  async create(owner: string, repo: string, input: { name: string; from: string }) {
    await this.repositories.assertAccessible(owner, repo);
    const name = validateBranchName(input.name);
    if (!isSafeGitHubRef(input.from)) throw new AppError("VALIDATION_ERROR", "Choose a valid base branch or commit.", 400, false, { from: "Invalid base reference" });
    let sha: string;
    try {
      const source = await this.github.request({
        path: `${this.base(owner, repo)}/commits/${encodeURIComponent(input.from)}`,
        schema: commitSchema,
        endpointTemplate: "/repos/{owner}/{repo}/commits/{ref}"
      });
      sha = source.data.sha;
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw new AppError("BRANCH_NOT_FOUND", "The base branch or commit was not found.", 404, false, { from: "Base reference not found" });
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
    try {
      const result = await this.github.request({
        method: "POST",
        path: `${this.base(owner, repo)}/git/refs`,
        body: { ref: `refs/heads/${name}`, sha },
        schema: refSchema,
        endpointTemplate: "/repos/{owner}/{repo}/git/refs"
      });
      return { branch: { name, sha: result.data.object.sha, isDefault: false, protected: false, updatedAt: null } };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 422) throw new AppError("BRANCH_ALREADY_EXISTS", "A branch with this name already exists.", 409, false, { name: "Branch already exists" });
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "BRANCH_WRITE_FORBIDDEN");
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
  }

  async remove(owner: string, repo: string, nameInput: string) {
    const detail = await this.repositories.detail(owner, repo);
    const name = validateBranchName(nameInput);
    if (name === detail.defaultBranch) throw new AppError("BRANCH_WRITE_FORBIDDEN", "The default branch cannot be deleted.", 403);
    try {
      await this.github.request({
        method: "DELETE",
        path: `${this.base(owner, repo)}/git/refs/heads/${encodeURIComponent(name)}`,
        schema: z.unknown(),
        endpointTemplate: "/repos/{owner}/{repo}/git/refs/heads/{branch}"
      });
      return { deleted: true as const };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw new AppError("BRANCH_NOT_FOUND", "The branch no longer exists.", 404);
      if (error instanceof GitHubApiError && (error.details.status === 409 || error.details.status === 422)) throw new AppError("BRANCH_WRITE_FORBIDDEN", "GitHub refused to delete this branch.", 403);
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "BRANCH_WRITE_FORBIDDEN");
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
  }

  private base(owner: string, repo: string) {
    return `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}`;
  }
}

export function validateBranchName(value: string): string {
  const name = value.trim();
  if (
    !name || name.length > 255 || name.toUpperCase() === "HEAD" || name.startsWith("-") || name.startsWith("/") || name.endsWith("/") ||
    name.includes("//") || name.includes("\\") || !branchNamePattern.test(name) || !isSafeGitHubRef(name)
  ) {
    throw new AppError("INVALID_BRANCH_NAME", "Use a valid Git branch name without spaces or reserved characters.", 400, false, { name: "Invalid branch name" });
  }
  return name;
}

function toBranch(branch: z.infer<typeof branchSchema>, defaultBranch: string): BranchDto {
  return {
    name: branch.name,
    sha: branch.commit.sha,
    isDefault: branch.name === defaultBranch,
    protected: branch.protected ?? false,
    updatedAt: null
  };
}
