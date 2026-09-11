import "server-only";
import pLimit from "p-limit";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { IMPORT_BLOB_TIMEOUT_MS, IMPORT_MUTATION_TIMEOUT_MS, importLimits } from "./constants";
import { ZipReader, type ZipPreflight } from "./zip-reader";
import { encodeGitHubSegment } from "@/lib/url";

const shaSchema = z.object({ sha: z.string().min(7) });

export type TreeItem = { path: string; mode: "100644" | "100755"; type: "blob"; sha: string };

export class GitObjectWriter {
  constructor(private readonly github: GitHubClient, private readonly reader: ZipReader) {}

  async writeBlobs(owner: string, repo: string, archive: ZipPreflight, options: { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void } = {}): Promise<TreeItem[]> {
    const base = this.base(owner, repo);
    const limit = pLimit(importLimits().blobConcurrency);
    let completed = 0;
    return Promise.all(archive.entries.map((item) => limit(async () => {
      if (options.signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
      const bytes = await this.reader.readEntry(archive.zip, item.entry);
      const blob = await this.github.request({
        method: "POST", path: `${base}/blobs`, body: { content: bytes.toString("base64"), encoding: "base64" },
        schema: shaSchema, timeoutMs: IMPORT_BLOB_TIMEOUT_MS, endpointTemplate: "/repos/{owner}/{repo}/git/blobs", signal: options.signal
      });
      completed += 1;
      options.onProgress?.(completed, archive.entries.length);
      return { path: item.path, mode: item.mode, type: "blob" as const, sha: blob.data.sha };
    })));
  }

  async createTree(owner: string, repo: string, tree: TreeItem[]): Promise<string> {
    const result = await this.github.request({
      method: "POST", path: `${this.base(owner, repo)}/trees`, body: { tree },
      schema: shaSchema, timeoutMs: IMPORT_MUTATION_TIMEOUT_MS, endpointTemplate: "/repos/{owner}/{repo}/git/trees"
    });
    return result.data.sha;
  }

  async createCommit(owner: string, repo: string, input: { message: string; tree: string; parents: string[] }): Promise<string> {
    const result = await this.github.request({
      method: "POST", path: `${this.base(owner, repo)}/commits`, body: input,
      schema: shaSchema, timeoutMs: IMPORT_MUTATION_TIMEOUT_MS, endpointTemplate: "/repos/{owner}/{repo}/git/commits"
    });
    return result.data.sha;
  }

  async publishRef(owner: string, repo: string, branch: string, sha: string): Promise<void> {
    await this.github.request({
      method: "POST", path: `${this.base(owner, repo)}/refs`, body: { ref: `refs/heads/${branch}`, sha },
      schema: z.unknown(), timeoutMs: IMPORT_MUTATION_TIMEOUT_MS, endpointTemplate: "/repos/{owner}/{repo}/git/refs"
    });
  }

  async configureDefaultBranch(owner: string, repo: string, branch: string): Promise<void> {
    await this.github.request({
      method: "PATCH", path: `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}`, body: { default_branch: branch },
      schema: z.unknown(), timeoutMs: IMPORT_MUTATION_TIMEOUT_MS, endpointTemplate: "/repos/{owner}/{repo}"
    });
  }

  async deleteRef(owner: string, repo: string, branch: string): Promise<void> {
    await this.github.request({
      method: "DELETE", path: `${this.base(owner, repo)}/refs/heads/${encodeURIComponent(branch)}`,
      schema: z.unknown(), timeoutMs: IMPORT_MUTATION_TIMEOUT_MS, endpointTemplate: "/repos/{owner}/{repo}/git/refs/heads/{branch}"
    });
  }

  async deleteRepository(owner: string, repo: string): Promise<void> {
    await this.github.request({
      method: "DELETE", path: `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}`,
      schema: z.unknown(), timeoutMs: IMPORT_MUTATION_TIMEOUT_MS, endpointTemplate: "/repos/{owner}/{repo}"
    });
  }

  private base(owner: string, repo: string) {
    return `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/git`;
  }
}
