import Link from "next/link";
import { CheckCircle2, CircleDot, MessageSquare } from "lucide-react";
import { relativeTime } from "@/lib/format";
import type { IssueSummaryDto } from "@/shared/contracts/issues";

export function IssueList({ issues, owner, repo }: { issues: IssueSummaryDto[]; owner?: string; repo?: string }) {
  const base = owner && repo ? `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues` : null;
  return <div className="issue-list">{issues.map((issue) => (
    <article className="issue-row" key={issue.id}>
      {issue.state === "open" ? <CircleDot className="state-icon state-open" aria-hidden="true"/> : <CheckCircle2 className="state-icon state-closed" aria-hidden="true"/>}
      <div>
        <Link className="issue-title" href={base ? `${base}/${issue.number}` : issue.url}>{issue.title}</Link>
        <div className="issue-meta">
          <span>#{issue.number}</span>
          <span>opened {relativeTime(issue.createdAt)} by {issue.user.login}</span>
          {issue.labels.map((label) => <span className="label-chip" key={label.name} style={{ borderColor: label.color ? `#${label.color}` : undefined }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: label.color ? `#${label.color}` : "var(--muted)" }}/>{label.name}</span>)}
        </div>
      </div>
      <span className="issue-meta" title={`${issue.comments} comments`}><MessageSquare style={{ width: 14, height: 14 }} aria-hidden="true"/>{issue.comments}</span>
    </article>
  ))}</div>;
}
