import "server-only";
import { z } from "zod";
import { isBinaryPath } from "@/lib/language";
import { encodeGitHubSegment, isSafeGitHubRef } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";
import type { CommitRefDto, TreeEntry, WriteFileInput } from "@/shared/contracts/content";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";

const treeEntrySchema = z.object({
  path: z.string().optional(),
  type: z.string(),
  sha: z.string(),
  size: z.number().nullable().optional()
});

const treeSchema = z.object({
  sha: z.string(),
  truncated: z.boolean().optional(),
  entries: z.array(treeEntrySchema).optional()
});

const fileMetaSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  type: z.string(),
  size: z.number().nullable().optional(),
  encoding: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  html_url: z.url().nullable().optional(),
  download_url: z.url().nullable().optional()
});

const commitAuthorSchema = z.object({
  login: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  avatar_url: z.url().nullable().optional(),
  date: z.string().nullable().optional()
}).nullable().optional();

const commitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: commitAuthorSchema
});

const writeResultSchema = z.object({
  content: z.object({ sha: z.string() }).nullable().optional(),
  commit: commitSchema
});

const deleteResultSchema = z.object({ commit: commitSchema });

export const writeFileSchema = z.object({
  path: z.string().min(1).max(1_024),
  content: z.string(),
  message: z.string().min(1).max(500),
  branch: z.string().min(1).max(255),
  sha: z.string().min(1).max(64).optional()
});

export const deleteFileSchema = z.object({
  path: z.string().min(1).max(1_024),
  message: z.string().min(1).max(500),
  branch: z.string().min(1).max(255),
  sha: z.string().min(1).max(64)
});

export class ContentService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async tree(owner: string, repo: string, refInput: string | undefined, pathInput: string, recursive: boolean) {
    const path = validateContentPath(pathInput, { allowEmpty: true });
    const ref = await this.resolveRef(owner, repo, refInput);
    try {
      const result = await this.github.request({
        path: `${this.base(owner, repo)}/git/trees/${encodeURIComponent(ref)}`,
        query: recursive ? { recursive: 1 } : undefined,
        schema: treeSchema,
        endpointTemplate: "/repos/{owner}/{repo}/git/trees/{tree_sha}"
      });
      const prefix = path ? `${path}/` : "";
      const entries = toTreeEntries(result.data).filter((entry) => !prefix || entry.path.startsWith(prefix));
      return { kind: "tree" as const, ref, path, entries };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw new AppError("CONTENT_NOT_FOUND", "This branch or path no longer exists.", 404);
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
  }

  async file(owner: string, repo: string, refInput: string | undefined, pathInput: string) {
    const path = validateContentPath(pathInput);
    const ref = await this.resolveRef(owner, repo, refInput);
    let meta: z.infer<typeof fileMetaSchema>;
    try {
      const result = await this.github.request({
        path: this.contentsPath(owner, repo, path),
        query: { ref },
        schema: z.unknown(),
        endpointTemplate: "/repos/{owner}/{repo}/contents/{path}"
      });
      const parsed = fileMetaSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.type !== "file") throw new AppError("CONTENT_NOT_FOUND", "This path does not point to a regular file.", 400, false, { path: "Not a file" });
      meta = parsed.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof GitHubApiError && error.details.status === 404) throw new AppError("CONTENT_NOT_FOUND", "This file no longer exists on the selected branch.", 404, false, { path: "File not found" });
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
    const size = typeof meta.size === "number" ? meta.size : 0;
    const blocked = meta.encoding === "none" || size > 1_000_000 || isBinaryPath(path);
    const shared = {
      path: meta.path,
      name: meta.name,
      sha: meta.sha,
      size,
      htmlUrl: meta.html_url ?? this.fileUrl(owner, repo, ref, path),
      downloadUrl: meta.download_url ?? null
    };
    if (blocked) return { kind: "file" as const, file: { ...shared, encoding: "none", content: "", decoded: false, truncated: true } };
    const raw = await this.github.request({
      path: this.contentsPath(owner, repo, path),
      query: { ref },
      schema: z.unknown(),
      accept: "application/vnd.github.raw+json",
      endpointTemplate: "/repos/{owner}/{repo}/contents/{path}"
    });
    const decoded = typeof meta.content === "string" ? Buffer.from(meta.content, "base64").toString("utf8") : null;
    const rawText = typeof raw.data === "string" ? raw.data : null;
    const content = rawText !== null && (decoded === null || decoded === rawText) ? rawText : decoded;
    if (content === null) return { kind: "file" as const, file: { ...shared, encoding: "none", content: "", decoded: false, truncated: true } };
    return { kind: "file" as const, file: { ...shared, encoding: "utf8", content, decoded: true, truncated: false } };
  }

  async write(owner: string, repo: string, input: WriteFileInput) {
    const path = validateContentPath(input.path);
    const message = validateCommitMessage(input.message);
    await this.repositories.assertAccessible(owner, repo);
    if (!isSafeGitHubRef(input.branch)) throw new AppError("VALIDATION_ERROR", "Choose a valid branch.", 400, false, { branch: "Invalid branch" });
    const body: { message: string; content: string; branch: string; sha?: string } = {
      message,
      content: Buffer.from(input.content, "utf8").toString("base64"),
      branch: input.branch
    };
    if (input.sha) body.sha = input.sha;
    try {
      const result = await this.github.request({
        method: "PUT",
        path: this.contentsPath(owner, repo, path),
        body,
        schema: writeResultSchema,
        endpointTemplate: "/repos/{owner}/{repo}/contents/{path}"
      });
      return { commit: toCommitRef(result.data.commit), path, sha: result.data.content?.sha ?? input.sha ?? result.data.commit.sha };
    } catch (error) {
      if (error instanceof GitHubApiError && (error.details.status === 409 || error.details.status === 422)) throw new AppError("CONTENT_WRITE_CONFLICT", "This file changed on GitHub or already exists with another revision. Reload before saving.", 409, false, { sha: "Reload and retry" });
      if (error instanceof GitHubApiError && error.details.status === 404) throw new AppError("CONTENT_NOT_FOUND", "The branch or path no longer exists.", 404);
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
  }

  async remove(owner: string, repo: string, input: { path: string; message: string; branch: string; sha: string }) {
    const path = validateContentPath(input.path);
    const message = validateCommitMessage(input.message);
    await this.repositories.assertAccessible(owner, repo);
    if (!isSafeGitHubRef(input.branch)) throw new AppError("VALIDATION_ERROR", "Choose a valid branch.", 400, false, { branch: "Invalid branch" });
    if (!input.sha.trim()) throw new AppError("VALIDATION_ERROR", "The file revision is required to delete it.", 400, false, { sha: "Missing revision" });
    try {
      const result = await this.github.request({
        method: "DELETE",
        path: this.contentsPath(owner, repo, path),
        body: { message, sha: input.sha, branch: input.branch },
        schema: deleteResultSchema,
        endpointTemplate: "/repos/{owner}/{repo}/contents/{path}"
      });
      return { commit: toCommitRef(result.data.commit), deleted: true as const };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw new AppError("CONTENT_NOT_FOUND", "This file no longer exists.", 404);
      if (error instanceof GitHubApiError && (error.details.status === 409 || error.details.status === 422)) throw new AppError("CONTENT_WRITE_CONFLICT", "This file changed on GitHub. Reload before deleting.", 409);
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
  }

  private base(owner: string, repo: string) {
    return `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}`;
  }

  private contentsPath(owner: string, repo: string, path: string) {
    return `${this.base(owner, repo)}/contents/${path.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
  }

  private fileUrl(owner: string, repo: string, ref: string, path: string) {
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(ref)}/${path.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
  }

  private async resolveRef(owner: string, repo: string, refInput: string | undefined) {
    const ref = refInput?.trim() ?? "";
    if (ref) {
      if (!isSafeGitHubRef(ref)) throw new AppError("VALIDATION_ERROR", "Choose a valid Git reference.", 400, false, { ref: "Invalid ref" });
      return ref;
    }
    return (await this.repositories.detail(owner, repo)).defaultBranch;
  }
}

export function validateContentPath(value: string, options: { allowEmpty?: boolean } = {}): string {
  const path = value.trim();
  if (!path && options.allowEmpty) return "";
  if (
    !path || path.length > 1_024 || path.startsWith("/") || path.startsWith(".git/") || path.includes("..") || path.includes("\\") ||
    path.split("/").some((segment) => !segment || segment === "." || segment.toLowerCase() === ".git")
  ) {
    throw new AppError("VALIDATION_ERROR", "Use a repository-relative file path.", 400, false, { path: "Invalid path" });
  }
  return path;
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const flattened = z.flattenError(error);
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
    const first = Array.isArray(messages) ? messages[0] : undefined;
    if (first) result[key] = first;
  }
  return result;
}

export function toTreeEntries(tree: z.infer<typeof treeSchema>): TreeEntry[] {
  const entries: TreeEntry[] = [];
  for (const entry of tree.entries ?? []) {
    if (!entry.path || (entry.type !== "blob" && entry.type !== "tree")) continue;
    entries.push({
      path: entry.path,
      name: entry.path.split("/").pop() ?? entry.path,
      type: entry.type,
      sha: entry.sha,
      size: entry.type === "tree" ? null : entry.size ?? null
    });
  }
  return entries;
}

function toCommitRef(commit: z.infer<typeof commitSchema>): CommitRefDto {
  return {
    sha: commit.sha,
    message: commit.message,
    authorLogin: commit.author?.login ?? null,
    authorName: commit.author?.name ?? "GitHub user",
    authorAvatar: commit.author?.avatar_url ?? null,
    authoredAt: commit.author?.date ?? null
  };
}

function validateCommitMessage(value: string): string {
  const message = value.trim();
  if (!message || message.length > 500) throw new AppError("VALIDATION_ERROR", "Use a commit message between 1 and 500 characters.", 400, false, { message: "Invalid commit message" });
  return message;
}
