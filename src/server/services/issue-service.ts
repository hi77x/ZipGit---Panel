import "server-only";
import { z } from "zod";
import { encodeGitHubSegment } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import type { ActorDto, CreateIssueInput, IssueCommentDto, IssueDetailDto, IssueSummaryDto, LabelDto, UpdateIssueInput } from "@/shared/contracts/issues";
import { RepositoryService } from "./repository-service";

const actorSchema = z.object({ login: z.string(), avatar_url: z.string().nullable().optional() });
const labelSchema = z.object({ name: z.string(), color: z.string().nullable().optional(), description: z.string().nullable().optional() });
const issueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.string(),
  state_reason: z.string().nullable().optional(),
  user: actorSchema.nullable().optional(),
  labels: z.array(z.union([labelSchema, z.string()])).default([]),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.url(),
  body: z.string().nullable().optional(),
  assignees: z.array(actorSchema).nullable().optional(),
  milestone: z.object({ title: z.string() }).nullable().optional(),
  locked: z.boolean().optional(),
  pull_request: z.unknown().optional()
});
const commentSchema = z.object({
  id: z.number(),
  body: z.string().nullable().optional(),
  user: actorSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
  html_url: z.url()
});
const searchSchema = z.object({ total_count: z.number() });

const titleRule = z.string().trim().min(1, "Title is required.").max(256, "Titles are limited to 256 characters.");
const labelRule = z.string().trim().min(1, "Labels cannot be empty.").max(50, "Labels are limited to 50 characters.");
const assigneeRule = z.string().trim().min(1, "Assignee logins cannot be empty.").max(100, "Assignee logins are limited to 100 characters.");
const bodyRule = z.string().max(65536, "Descriptions are limited to 65,536 characters.");

const createIssueSchema = z.object({
  title: titleRule,
  body: bodyRule.optional().default(""),
  labels: z.array(labelRule).max(20, "At most 20 labels are allowed.").optional(),
  assignees: z.array(assigneeRule).max(10, "At most 10 assignees are allowed.").optional()
});
const updateIssueSchema = z.object({
  state: z.enum(["open", "closed"]).optional(),
  title: titleRule.optional(),
  body: bodyRule.optional(),
  labels: z.array(labelRule).max(20, "At most 20 labels are allowed.").optional(),
  state_reason: z.enum(["completed", "not_planned", "reopened"]).optional()
}).superRefine((value, context) => {
  if (!value.state_reason) return;
  if (!value.state) {
    context.addIssue({ code: "custom", message: "Choose a state before selecting a reason.", path: ["state_reason"] });
    return;
  }
  if (value.state === "open" && value.state_reason !== "reopened") context.addIssue({ code: "custom", message: "Reopening supports only the reopened reason.", path: ["state_reason"] });
  if (value.state === "closed" && value.state_reason === "reopened") context.addIssue({ code: "custom", message: "Closing supports completed or not planned.", path: ["state_reason"] });
});
const commentInputSchema = z.object({ body: z.string().trim().min(1, "Write a comment before submitting.").max(65536, "Comments are limited to 65,536 characters.") });

export function parseCreateIssue(input: unknown): CreateIssueInput {
  const parsed = createIssueSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Review the issue details and try again.", 400, false, fieldErrors(parsed.error));
  return parsed.data;
}

export function parseUpdateIssue(input: unknown): UpdateIssueInput {
  const parsed = updateIssueSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Review the issue changes and try again.", 400, false, fieldErrors(parsed.error));
  return parsed.data;
}

export function parseCommentBody(input: unknown): string {
  const parsed = commentInputSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "The comment is not valid.", 400, false, fieldErrors(parsed.error));
  return parsed.data.body;
}

export class IssueService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async list(owner: string, repo: string, query: { state: "open" | "closed" | "all"; page: number; perPage: number }) {
    await this.repositories.assertAccessible(owner, repo);
    try {
      const [result, openCount, closedCount] = await Promise.all([
        this.github.request({ path: this.base(owner, repo), query: { state: query.state, page: query.page, per_page: query.perPage }, schema: z.array(issueSchema), endpointTemplate: "/repos/{owner}/{repo}/issues" }),
        this.count(owner, repo, "open"),
        this.count(owner, repo, "closed")
      ]);
      const issues = result.data.filter((issue) => issue.pull_request == null).map(toIssueSummary);
      return { issues, page: query.page, hasNext: Boolean(result.links.next), openCount, closedCount };
    } catch (error) {
      return this.rethrow(error, false);
    }
  }

  async detail(owner: string, repo: string, number: number) {
    await this.repositories.assertAccessible(owner, repo);
    try {
      const [issue, comments] = await Promise.all([
        this.github.request({ path: `${this.base(owner, repo)}/${number}`, schema: issueSchema, endpointTemplate: "/repos/{owner}/{repo}/issues/{number}" }),
        this.github.request({ path: `${this.base(owner, repo)}/${number}/comments`, query: { page: 1, per_page: 100 }, schema: z.array(commentSchema), endpointTemplate: "/repos/{owner}/{repo}/issues/{number}/comments" })
      ]);
      return { issue: toIssueDetail(issue.data), comments: comments.data.map(toComment) };
    } catch (error) {
      return this.rethrow(error, false);
    }
  }

  async create(owner: string, repo: string, input: CreateIssueInput) {
    await this.repositories.assertAccessible(owner, repo);
    try {
      const result = await this.github.request({
        method: "POST",
        path: this.base(owner, repo),
        body: { title: input.title, body: input.body, labels: input.labels, assignees: input.assignees },
        schema: issueSchema,
        endpointTemplate: "/repos/{owner}/{repo}/issues"
      });
      return toIssueDetail(result.data);
    } catch (error) {
      return this.rethrow(error, true);
    }
  }

  async update(owner: string, repo: string, number: number, input: UpdateIssueInput) {
    await this.repositories.assertAccessible(owner, repo);
    try {
      const result = await this.github.request({
        method: "PATCH",
        path: `${this.base(owner, repo)}/${number}`,
        body: { state: input.state, title: input.title, body: input.body, labels: input.labels, state_reason: input.state_reason },
        schema: issueSchema,
        endpointTemplate: "/repos/{owner}/{repo}/issues/{number}"
      });
      return toIssueDetail(result.data);
    } catch (error) {
      return this.rethrow(error, true);
    }
  }

  async comments(owner: string, repo: string, number: number, page: number) {
    await this.repositories.assertAccessible(owner, repo);
    try {
      const result = await this.github.request({
        path: `${this.base(owner, repo)}/${number}/comments`,
        query: { page, per_page: 100 },
        schema: z.array(commentSchema),
        endpointTemplate: "/repos/{owner}/{repo}/issues/{number}/comments"
      });
      return { comments: result.data.map(toComment), page, hasNext: Boolean(result.links.next) };
    } catch (error) {
      return this.rethrow(error, false);
    }
  }

  async addComment(owner: string, repo: string, number: number, body: string) {
    await this.repositories.assertAccessible(owner, repo);
    try {
      const result = await this.github.request({
        method: "POST",
        path: `${this.base(owner, repo)}/${number}/comments`,
        body: { body },
        schema: commentSchema,
        endpointTemplate: "/repos/{owner}/{repo}/issues/{number}/comments"
      });
      return toComment(result.data);
    } catch (error) {
      return this.rethrow(error, true);
    }
  }

  private async count(owner: string, repo: string, state: "open" | "closed"): Promise<number> {
    try {
      const result = await this.github.request({
        path: "/search/issues",
        query: { q: `repo:${owner}/${repo} type:issue state:${state}`, per_page: 1 },
        schema: searchSchema,
        endpointTemplate: "/search/issues"
      });
      return result.data.total_count;
    } catch {
      return 0;
    }
  }

  private base(owner: string, repo: string) {
    return `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/issues`;
  }

  private rethrow(error: unknown, write: boolean): never {
    if (error instanceof GitHubApiError) {
      if (write && error.details.status === 403) throw mapGitHubError(error, "ISSUE_WRITE_PERMISSION_REQUIRED");
      if (error.details.status === 404) throw mapGitHubError(error, "ISSUE_NOT_FOUND");
      throw mapGitHubError(error);
    }
    throw error;
  }
}

function toActor(user: z.infer<typeof actorSchema> | null | undefined): ActorDto {
  return { login: user?.login ?? "ghost", avatarUrl: user?.avatar_url ?? null };
}

function toLabel(label: z.infer<typeof labelSchema> | string): LabelDto {
  if (typeof label === "string") return { name: label, color: "", description: null };
  return { name: label.name, color: label.color ?? "", description: label.description ?? null };
}

function toIssueSummary(issue: z.infer<typeof issueSchema>): IssueSummaryDto {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state === "closed" ? "closed" : "open",
    stateReason: issue.state_reason ?? null,
    user: toActor(issue.user),
    labels: issue.labels.map(toLabel),
    comments: issue.comments,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
    isPullRequest: issue.pull_request != null
  };
}

function toIssueDetail(issue: z.infer<typeof issueSchema>): IssueDetailDto {
  return {
    ...toIssueSummary(issue),
    body: issue.body ?? "",
    assignees: (issue.assignees ?? []).map(toActor),
    milestone: issue.milestone?.title ?? null,
    locked: issue.locked ?? false
  };
}

function toComment(comment: z.infer<typeof commentSchema>): IssueCommentDto {
  return {
    id: comment.id,
    body: comment.body ?? "",
    user: toActor(comment.user),
    createdAt: comment.created_at,
    updatedAt: comment.updated_at ?? null,
    url: comment.html_url
  };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = typeof issue.path[0] === "string" ? issue.path[0] : "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
