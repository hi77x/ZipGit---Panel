import { Explorer } from "@/features/code-explorer/explorer";
import { isSafeGitHubRef } from "@/lib/url";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { capabilitiesForRepository } from "@/server/authz/capabilities";
import { BranchService } from "@/server/services/branch-service";
import { ContentService } from "@/server/services/content-service";
import { RepositoryService } from "@/server/services/repository-service";
import type { BranchDto, FileContentDto, TreeEntry } from "@/shared/contracts/content";

export default async function CodePage({ params, searchParams }: { params: Promise<{ owner: string; repo: string; path?: string[] }>; searchParams: Promise<{ ref?: string }> }) {
  const { owner, repo, path } = await params;
  const { ref: requestedRef } = await searchParams;
  const { accessToken } = await requireGitHubSession();
  const github = new GitHubClient(accessToken, crypto.randomUUID());
  const repositories = new RepositoryService(github);
  const detail = await repositories.detail(owner, repo);
  const canWrite = capabilitiesForRepository(detail).writeCode;
  const ref = requestedRef && isSafeGitHubRef(requestedRef) ? requestedRef : detail.defaultBranch;
  const content = new ContentService(github, repositories);
  let branches: BranchDto[] = [];
  try {
    branches = (await new BranchService(github, repositories).list(owner, repo)).branches;
  } catch {
    branches = [];
  }
  let entries: TreeEntry[] | null = null;
  let treeError: string | null = null;
  try {
    entries = (await content.tree(owner, repo, ref, "", true)).entries;
  } catch (error) {
    treeError = errorMessage(error);
  }
  const filePath = path?.length ? path.join("/") : null;
  let file: FileContentDto | null = null;
  let fileError: string | null = null;
  if (filePath) {
    try {
      file = (await content.file(owner, repo, ref, filePath)).file;
    } catch (error) {
      fileError = errorMessage(error);
    }
  }
  return <Explorer
    owner={owner}
    repo={repo}
    initialRef={ref}
    defaultBranch={detail.defaultBranch}
    initialBranches={branches}
    initialEntries={entries}
    initialTreeError={treeError}
    initialPath={filePath}
    initialFile={file}
    initialFileError={fileError}
    canWrite={canWrite}
  />;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "This resource could not be loaded from GitHub.";
}
