import "server-only";
import pLimit from "p-limit";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { importLimits } from "./constants";
import { ZipReader, type ZipPreflight } from "./zip-reader";
import { encodeGitHubSegment } from "@/lib/url";

const shaSchema = z.object({ sha: z.string().min(7) });

export class GitObjectWriter {
  constructor(private readonly github: GitHubClient, private readonly reader: ZipReader) {}

  async write(owner: string, repo: string, archive: ZipPreflight, commitMessage: string, branch: string, onProgress?: (completed: number, total: number) => void) {
    const base = `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/git`;
    const limit = pLimit(importLimits().blobConcurrency);
    let completed = 0;
    const tree = await Promise.all(archive.entries.map((item) => limit(async () => {
      const bytes = await this.reader.readEntry(archive.zip, item.entry);
      const blob = await this.github.request({ method: "POST", path: `${base}/blobs`, body: { content: bytes.toString("base64"), encoding: "base64" }, schema: shaSchema, timeoutMs: 60_000, endpointTemplate: "/repos/{owner}/{repo}/git/blobs" });
      completed += 1; onProgress?.(completed, archive.entries.length);
      return { path: item.path, mode: item.mode, type: "blob" as const, sha: blob.data.sha };
    })));
    const rootTree = await this.github.request({ method: "POST", path: `${base}/trees`, body: { tree }, schema: shaSchema, timeoutMs: 60_000, endpointTemplate: "/repos/{owner}/{repo}/git/trees" });
    const commit = await this.github.request({ method: "POST", path: `${base}/commits`, body: { message: commitMessage, tree: rootTree.data.sha, parents: [] }, schema: shaSchema, timeoutMs: 60_000, endpointTemplate: "/repos/{owner}/{repo}/git/commits" });
    await this.github.request({ method: "POST", path: `${base}/refs`, body: { ref: `refs/heads/${branch}`, sha: commit.data.sha }, schema: z.unknown(), timeoutMs: 60_000, endpointTemplate: "/repos/{owner}/{repo}/git/refs" });
    await this.github.request({ method: "PATCH", path: `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}`, body: { default_branch: branch }, schema: z.unknown(), endpointTemplate: "/repos/{owner}/{repo}" });
    await this.github.request({ path: `${base}/ref/heads/${encodeURIComponent(branch)}`, schema: z.unknown(), endpointTemplate: "/repos/{owner}/{repo}/git/ref/heads/{branch}" });
    return { commitSha: commit.data.sha, createdBlobCount: completed };
  }
}
