import "server-only";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";
import { requireCapability } from "@/server/authz/capabilities";
import { encodeGitHubSegment } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";
import type { ActorDto, IssueCommentDto } from "@/shared/contracts/issues";
import type { CreatePullInput, MergePullInput, MergeResultDto, PullDetailDto, PullFileDto, PullReviewDto, PullSummaryDto } from "@/shared/contracts/pulls";

const actorSchema = z.object({ login: z.string(), avatar_url: z.string().nullable().optional() });
const labelSchema = z.object({ name: z.string(), color: z.string(), description: z.string().nullable().optional() });
const refSchema = z.object({ ref: z.string(), sha: z.string(), label: z.string().nullable().optional() });
const pullSchema = z.object({
  id: z.number(), number: z.number(), title: z.string(), state: z.string(),
  draft: z.boolean().nullable().optional(), merged: z.boolean().nullable().optional(),
  mergeable: z.boolean().nullable().optional(), mergeable_state: z.string().nullable().optional(),
  user: actorSchema.nullable().optional(), head: refSchema, base: refSchema,
  labels: z.array(labelSchema).nullable().optional(),
  comments: z.number().nullable().optional(), review_comments: z.number().nullable().optional(), commits: z.number().nullable().optional(),
  additions: z.number().nullable().optional(), deletions: z.number().nullable().optional(), changed_files: z.number().nullable().optional(),
  created_at: z.string(), updated_at: z.string(), merged_at: z.string().nullable().optional(),
  html_url: z.string(), body: z.string().nullable().optional(),
  merged_by: actorSchema.nullable().optional(), requested_reviewers: z.array(actorSchema).nullable().optional(),
  maintainer_can_modify: z.boolean().nullable().optional()
});
const fileSchema = z.object({
  filename: z.string(), previous_filename: z.string().nullable().optional(), status: z.string(),
  additions: z.number().nullable().optional(), deletions: z.number().nullable().optional(), changes: z.number().nullable().optional(),
  patch: z.string().nullable().optional()
});
const reviewSchema = z.object({
  id: z.number(), user: actorSchema.nullable().optional(), state: z.string(),
  body: z.string().nullable().optional(), submitted_at: z.string().nullable().optional()
});
const commentSchema = z.object({
  id: z.number(), body: z.string().nullable().optional(), user: actorSchema.nullable().optional(),
  created_at: z.string(), updated_at: z.string().nullable().optional(), html_url: z.string()
});
const mergeResultSchema = z.object({ merged: z.boolean(), message: z.string(), sha: z.string().nullable().optional() });

type PullPayload = z.infer<typeof pullSchema>;
type FilePayload = z.infer<typeof fileSchema>;
type ReviewPayload = z.infer<typeof reviewSchema>;
type CommentPayload = z.infer<typeof commentSchema>;

export type PullListQuery = { state: "open" | "closed" | "all"; page: number; perPage: number };
export type PullCommentInput = { body: string; event?: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" };

export class PullService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async list(owner: string, repo: string, query: PullListQuery) {
    await this.repositories.assertAccessible(owner, repo);
    const result = await this.github.request({
      path: `${this.base(owner, repo)}/pulls`,
      query: { state: query.state, sort: "updated", direction: "desc", page: query.page, per_page: query.perPage },
      schema: z.array(pullSchema),
      endpointTemplate: "/repos/{owner}/{repo}/pulls"
    });
    return { pulls: result.data.map(toSummary), page: query.page, hasNext: Boolean(result.links.next) };
  }

  async detail(owner: string, repo: string, number: number) {
    await this.repositories.assertAccessible(owner, repo);
    const [pull, reviews, comments] = await Promise.all([
      this.fetchPull(owner, repo, number),
      this.fetchReviews(owner, repo, number),
      this.fetchComments(owner, repo, number)
    ]);
    return { pull, reviews, comments };
  }

  async overview(owner: string, repo: string, number: number) {
    await this.repositories.assertAccessible(owner, repo);
    const [pull, files, reviews, commentData] = await Promise.all([
      this.fetchPull(owner, repo, number),
      this.fetchFiles(owner, repo, number),
      this.fetchReviews(owner, repo, number),
      this.fetchComments(owner, repo, number)
    ]);
    return { pull, files: files.files, truncated: files.truncated, reviews, comments: commentData.comments };
  }

  async files(owner: string, repo: string, number: number) {
    await this.repositories.assertAccessible(owner, repo);
    return this.fetchFiles(owner, repo, number);
  }

  async comments(owner: string, repo: string, number: number) {
    await this.repositories.assertAccessible(owner, repo);
    const [comments, reviews] = await Promise.all([
      this.fetchComments(owner, repo, number),
      this.fetchReviews(owner, repo, number)
    ]);
    return { comments: comments.comments, reviews, hasNext: comments.hasNext };
  }

  async create(owner: string, repo: string, input: CreatePullInput): Promise<PullDetailDto> {
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, "createPullRequest");
    try {
      const result = await this.github.request({
        method: "POST",
        path: `${this.base(owner, repo)}/pulls`,
        body: { title: input.title, head: input.head, base: input.base, body: input.body, draft: input.draft },
        schema: pullSchema,
        endpointTemplate: "/repos/{owner}/{repo}/pulls"
      });
      return toDetail(result.data);
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 422) {
        throw new AppError("PULL_NOT_MERGEABLE", "No commits between the selected branches or a pull request already exists.", 422);
      }
      if (error instanceof GitHubApiError && error.details.status === 403) {
        throw new AppError("PULL_WRITE_PERMISSION_REQUIRED", "GitHub did not grant permission to create pull requests in this repository.", 403);
      }
      throw error;
    }
  }

  async createComment(owner: string, repo: string, number: number, input: PullCommentInput) {
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, "reviewPullRequest");
    try {
      if (input.event) {
        const result = await this.github.request({
          method: "POST",
          path: `${this.base(owner, repo)}/pulls/${number}/reviews`,
          body: { body: input.body, event: input.event },
          schema: reviewSchema,
          endpointTemplate: "/repos/{owner}/{repo}/pulls/{number}/reviews"
        });
        return { review: toReview(result.data) };
      }
      const result = await this.github.request({
        method: "POST",
        path: `${this.base(owner, repo)}/issues/${number}/comments`,
        body: { body: input.body },
        schema: commentSchema,
        endpointTemplate: "/repos/{owner}/{repo}/issues/{number}/comments"
      });
      return { comment: toComment(result.data) };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) {
        throw new AppError("PULL_NOT_FOUND", "This pull request no longer exists or is not accessible.", 404);
      }
      if (error instanceof GitHubApiError && error.details.status === 403) {
        throw mapGitHubError(error, "PULL_WRITE_PERMISSION_REQUIRED");
      }
      throw error;
    }
  }

  async merge(owner: string, repo: string, number: number, input: MergePullInput): Promise<MergeResultDto> {
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, "mergePullRequest");
    const result = await this.requestMerge(owner, repo, number, input);
    let branchDeleted = false;
    if (result.merged && input.deleteBranch) {
      branchDeleted = await this.deleteHeadBranch(owner, repo, number).catch(() => false);
    }
    return { merged: result.merged, message: result.message, sha: result.sha ?? null, branchDeleted };
  }

  async setState(owner: string, repo: string, number: number, state: "open" | "closed"): Promise<PullDetailDto> {
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, "managePullRequests");
    try {
      const result = await this.github.request({
        method: "PATCH",
        path: `${this.base(owner, repo)}/pulls/${number}`,
        body: { state },
        schema: pullSchema,
        endpointTemplate: "/repos/{owner}/{repo}/pulls/{number}"
      });
      return toDetail(result.data);
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) {
        throw new AppError("PULL_NOT_FOUND", "This pull request no longer exists or is not accessible.", 404);
      }
      if (error instanceof GitHubApiError && error.details.status === 403) {
        throw new AppError("PULL_WRITE_PERMISSION_REQUIRED", "GitHub did not grant permission to change this pull request.", 403);
      }
      throw error;
    }
  }

  private base(owner: string, repo: string): string {
    return `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}`;
  }

  private async fetchPull(owner: string, repo: string, number: number): Promise<PullDetailDto> {
    try {
      const result = await this.github.request({
        path: `${this.base(owner, repo)}/pulls/${number}`,
        schema: pullSchema,
        endpointTemplate: "/repos/{owner}/{repo}/pulls/{number}"
      });
      return toDetail(result.data);
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) {
        throw new AppError("PULL_NOT_FOUND", "This pull request could not be found.", 404);
      }
      throw error;
    }
  }

  private async fetchFiles(owner: string, repo: string, number: number): Promise<{ files: PullFileDto[]; truncated: boolean }> {
    const path = `${this.base(owner, repo)}/pulls/${number}/files`;
    try {
      const first = await this.github.request({ path, query: { per_page: 100 }, schema: z.array(fileSchema), endpointTemplate: "/repos/{owner}/{repo}/pulls/{number}/files" });
      const files = first.data.map(toFile);
      if (!first.links.next) return { files, truncated: false };
      const second = await this.github.request({ path, query: { per_page: 100, page: 2 }, schema: z.array(fileSchema), endpointTemplate: "/repos/{owner}/{repo}/pulls/{number}/files" });
      return { files: [...files, ...second.data.map(toFile)], truncated: Boolean(second.links.next) };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) {
        throw new AppError("PULL_NOT_FOUND", "This pull request could not be found.", 404);
      }
      throw error;
    }
  }

  private async fetchReviews(owner: string, repo: string, number: number): Promise<PullReviewDto[]> {
    try {
      const result = await this.github.request({
        path: `${this.base(owner, repo)}/pulls/${number}/reviews`,
        query: { per_page: 100 },
        schema: z.array(reviewSchema),
        endpointTemplate: "/repos/{owner}/{repo}/pulls/{number}/reviews"
      });
      return result.data.map(toReview);
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) {
        throw new AppError("PULL_NOT_FOUND", "This pull request could not be found.", 404);
      }
      throw error;
    }
  }

  private async fetchComments(owner: string, repo: string, number: number): Promise<{ comments: IssueCommentDto[]; hasNext: boolean }> {
    try {
      const result = await this.github.request({
        path: `${this.base(owner, repo)}/issues/${number}/comments`,
        query: { per_page: 100 },
        schema: z.array(commentSchema),
        endpointTemplate: "/repos/{owner}/{repo}/issues/{number}/comments"
      });
      return { comments: result.data.map(toComment), hasNext: Boolean(result.links.next) };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) {
        throw new AppError("PULL_NOT_FOUND", "This pull request could not be found.", 404);
      }
      throw error;
    }
  }

  private async requestMerge(owner: string, repo: string, number: number, input: MergePullInput) {
    try {
      const result = await this.github.request({
        method: "PUT",
        path: `${this.base(owner, repo)}/pulls/${number}/merge`,
        body: { merge_method: input.method, commit_title: input.commitTitle, commit_message: input.commitMessage },
        schema: mergeResultSchema,
        endpointTemplate: "/repos/{owner}/{repo}/pulls/{number}/merge"
      });
      return result.data;
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 405) {
        throw new AppError("PULL_NOT_MERGEABLE", "GitHub reports this pull request cannot be merged in its current state.", 409);
      }
      if (error instanceof GitHubApiError && error.details.status === 409) {
        throw new AppError("PULL_NOT_MERGEABLE", "This pull request has conflicts with the base branch. Resolve them before merging.", 409);
      }
      if (error instanceof GitHubApiError && error.details.status === 422) {
        throw new AppError("PULL_NOT_MERGEABLE", "GitHub rejected the merge request. Confirm the pull request state and merge method.", 422);
      }
      if (error instanceof GitHubApiError && error.details.status === 403) {
        throw new AppError("PULL_WRITE_PERMISSION_REQUIRED", "GitHub did not grant permission to merge this pull request.", 403);
      }
      if (error instanceof GitHubApiError && error.details.status === 404) {
        throw new AppError("PULL_NOT_FOUND", "This pull request could not be found.", 404);
      }
      throw error;
    }
  }

  private async deleteHeadBranch(owner: string, repo: string, number: number): Promise<boolean> {
    const pull = await this.fetchPull(owner, repo, number);
    if (!pull.head.label.toLowerCase().startsWith(`${owner.toLowerCase()}:`)) return false;
    const ref = pull.head.ref.split("/").map(encodeURIComponent).join("/");
    try {
      await this.github.request({
        method: "DELETE",
        path: `${this.base(owner, repo)}/git/refs/heads/${ref}`,
        schema: z.unknown(),
        endpointTemplate: "/repos/{owner}/{repo}/git/refs/heads/{ref}"
      });
      return true;
    } catch {
      return false;
    }
  }
}

export function parsePullNumber(value: string | number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new AppError("PULL_NOT_FOUND", "The pull request number is not valid.", 404);
  }
  return number;
}

function toActor(actor: { login: string; avatar_url?: string | null } | null | undefined): ActorDto {
  return { login: actor?.login ?? "ghost", avatarUrl: actor?.avatar_url ?? null };
}

function toSummary(pull: PullPayload): PullSummaryDto {
  return {
    id: pull.id, number: pull.number, title: pull.title,
    state: pull.state === "closed" ? "closed" : "open",
    draft: pull.draft ?? false, merged: pull.merged ?? false,
    mergeable: pull.mergeable ?? null, mergeableState: pull.mergeable_state ?? null,
    user: toActor(pull.user),
    head: { ref: pull.head.ref, sha: pull.head.sha, label: pull.head.label ?? pull.head.ref },
    base: { ref: pull.base.ref, sha: pull.base.sha, label: pull.base.label ?? pull.base.ref },
    labels: (pull.labels ?? []).map((label) => ({ name: label.name, color: label.color, description: label.description ?? null })),
    comments: pull.comments ?? 0, reviewComments: pull.review_comments ?? 0, commits: pull.commits ?? 0,
    additions: pull.additions ?? 0, deletions: pull.deletions ?? 0, changedFiles: pull.changed_files ?? 0,
    createdAt: pull.created_at, updatedAt: pull.updated_at, mergedAt: pull.merged_at ?? null,
    url: pull.html_url
  };
}

function toDetail(pull: PullPayload): PullDetailDto {
  return {
    ...toSummary(pull),
    body: pull.body ?? "",
    mergedBy: pull.merged_by ? toActor(pull.merged_by) : null,
    requestedReviewers: (pull.requested_reviewers ?? []).map(toActor),
    maintainerCanModify: pull.maintainer_can_modify ?? false
  };
}

function toFile(file: FilePayload): PullFileDto {
  const additions = file.additions ?? 0;
  const deletions = file.deletions ?? 0;
  return {
    filename: file.filename, previousFilename: file.previous_filename ?? null, status: file.status,
    additions, deletions, changes: file.changes ?? additions + deletions,
    patch: file.patch ?? null, binary: file.patch == null, truncated: false
  };
}

function toReview(review: ReviewPayload): PullReviewDto {
  return { id: review.id, user: toActor(review.user), state: review.state, body: review.body ?? "", submittedAt: review.submitted_at ?? null };
}

function toComment(comment: CommentPayload): IssueCommentDto {
  return {
    id: comment.id, body: comment.body ?? "", user: toActor(comment.user),
    createdAt: comment.created_at, updatedAt: comment.updated_at ?? null, url: comment.html_url
  };
}
