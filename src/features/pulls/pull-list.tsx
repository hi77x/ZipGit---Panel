import Link from "next/link";
import { GitPullRequest, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/feedback/states";
import { relativeTime } from "@/lib/format";
import type { PullSummaryDto } from "@/shared/contracts/pulls";

export function PullList({ pulls, owner, repo }: { pulls: PullSummaryDto[]; owner: string; repo: string }) {
  if (!pulls.length) return <EmptyState title="No pull requests" message="No pull requests match this filter yet."/>;
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
  return <div className="issue-list">{pulls.map((pull) => {
    const stateClass = pull.merged ? "state-merged" : pull.draft && pull.state === "open" ? "state-draft" : pull.state === "open" ? "state-open" : "state-closed";
    const stateLabel = pull.merged ? "Merged" : pull.draft && pull.state === "open" ? "Draft" : pull.state === "open" ? "Open" : "Closed";
    return <article className="issue-row" key={pull.id}>
      <GitPullRequest className={`state-icon ${stateClass}`} aria-label={stateLabel}/>
      <div>
        <Link className="issue-title" href={`${base}/${pull.number}`}>{pull.title}</Link>
        <div className="issue-meta">
          <span>#{pull.number}</span>
          <span>by {pull.user.login}</span>
          <span className="cluster" style={{ gap: 4 }}><code>{pull.head.label}</code><span aria-hidden="true">→</span><code>{pull.base.label}</code></span>
          <span className="cluster" style={{ gap: 4 }}><MessageSquare style={{ width: 13, height: 13 }} aria-hidden="true"/>{pull.reviewComments}</span>
          <span>updated {relativeTime(pull.updatedAt)}</span>
        </div>
      </div>
      <span className="muted text-xs"><span className="diff-add-count">+{pull.additions}</span> <span className="diff-del-count">−{pull.deletions}</span></span>
    </article>;
  })}</div>;
}
