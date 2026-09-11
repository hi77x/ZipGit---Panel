import { Terminal } from "lucide-react";
import { DiffViewer } from "@/components/diff/diff-viewer";
import { ErrorState } from "@/components/feedback/states";
import { ButtonLink } from "@/components/ui/button";
import { CommitHeader } from "@/features/commits/commit-header";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { CommitService } from "@/server/services/commit-service";
import type { CommitDto } from "@/shared/contracts/content";

export default async function CommitDetailPage({ params }: { params: Promise<{ owner: string; repo: string; sha: string }> }) {
  const { owner, repo, sha } = await params;
  let commit: CommitDto | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    commit = await new CommitService(new GitHubClient(accessToken, crypto.randomUUID())).detail(owner, repo, sha);
  } catch {
    return <ErrorState title="Commit unavailable" message="This commit could not be loaded from GitHub. It may no longer exist or the ref may be invalid."/>;
  }
  if (!commit) return <ErrorState title="Commit unavailable" message="This commit could not be loaded from GitHub."/>;
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return <section>
    <CommitHeader commit={commit} owner={owner} repo={repo}/>
    <div className="row-actions" style={{ margin: "16px 0" }}>
      <ButtonLink href={`${base}/code?ref=${encodeURIComponent(commit.sha)}`}><Terminal/> Browse files at this commit</ButtonLink>
    </div>
    <DiffViewer files={commit.files} storageKey={`${owner}/${repo}/${commit.sha}`}/>
  </section>;
}
