import { ArrowRight, ExternalLink, FileDiff, GitPullRequest, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/states";
import { DiffViewer } from "@/components/diff/diff-viewer";
import { PullMergeBox } from "@/features/pulls/pull-merge-box";
import { PullThread } from "@/features/pulls/pull-thread";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { PullService, parsePullNumber } from "@/server/services/pull-service";
import { relativeTime } from "@/lib/format";

export default async function PullDetailPage({ params }: { params: Promise<{ owner: string; repo: string; number: string }> }) {
  const { owner, repo, number } = await params;
  let pullNumber: number;
  try { pullNumber = parsePullNumber(number); }
  catch { return <ErrorState title="Pull request unavailable" message="The pull request number is not valid."/>; }
  let data: Awaited<ReturnType<PullService["overview"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new PullService(new GitHubClient(accessToken, crypto.randomUUID())).overview(owner, repo, pullNumber);
  } catch { return <ErrorState title="Pull request unavailable" message="This pull request could not be loaded from GitHub."/>; }
  const { pull, files, truncated, reviews, comments } = data;
  const stateLabel = pull.merged ? "Merged" : pull.draft && pull.state === "open" ? "Draft" : pull.state === "open" ? "Open" : "Closed";
  const stateTone = pull.merged ? "accent" : pull.state === "open" ? (pull.draft ? "neutral" : "success") : "danger";
  const stateClass = pull.merged ? "state-merged" : pull.draft && pull.state === "open" ? "state-draft" : pull.state === "open" ? "state-open" : "state-closed";
  return <div className="overview-grid">
    <div className="stack">
      <header className="section-heading" style={{ marginTop: 0 }}>
        <div>
          <div className="cluster">
            <GitPullRequest className={`state-icon ${stateClass}`} aria-label={stateLabel}/>
            <h2 style={{ margin: 0 }}>{pull.title}</h2>
            <span className="muted">#{pull.number}</span>
            <Badge tone={stateTone}>{stateLabel}</Badge>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>Opened {relativeTime(pull.createdAt)} by {pull.user.login} · {pull.commits} commits · {pull.changedFiles} files · <span className="diff-add-count">+{pull.additions}</span> <span className="diff-del-count">−{pull.deletions}</span></p>
          <div className="cluster" style={{ marginTop: 8 }}>
            <code>{pull.head.label}</code><ArrowRight style={{ width: 14, height: 14 }} aria-hidden="true"/><code>{pull.base.label}</code>
            {pull.mergedAt ? <span className="muted text-xs">merged {relativeTime(pull.mergedAt)}</span> : null}
          </div>
        </div>
        <a className="button button-ghost" href={pull.url} target="_blank" rel="noopener noreferrer">Open on GitHub <ExternalLink style={{ width: 14, height: 14 }} aria-hidden="true"/></a>
      </header>
      <nav className="tabs" aria-label="Pull request sections">
        <a className="tab" href="#conversation"><MessageSquare aria-hidden="true"/> Conversation <span className="tab-count">{comments.length + reviews.length}</span></a>
        <a className="tab" href="#files"><FileDiff aria-hidden="true"/> Files changed <span className="tab-count">{files.length}</span></a>
      </nav>
      <section id="conversation">
        <PullThread owner={owner} repo={repo} number={pull.number} pull={pull} reviews={reviews} comments={comments}/>
      </section>
      <section id="files" style={{ marginTop: 24 }}>
        <header className="section-heading" style={{ marginTop: 0 }}>
          <div><h2>Files changed</h2><p>{files.length} file{files.length === 1 ? "" : "s"} · <span className="diff-add-count">+{pull.additions}</span> <span className="diff-del-count">−{pull.deletions}</span></p></div>
        </header>
        {truncated ? <div className="inline-warning">Only the first 200 changed files are shown. Open the pull request on GitHub for the complete diff.</div> : null}
        <DiffViewer files={files} storageKey={`${owner}/${repo}/pr/${pull.number}`}/>
      </section>
    </div>
    <aside className="stack">
      <PullMergeBox owner={owner} repo={repo} pull={pull}/>
    </aside>
  </div>;
}
