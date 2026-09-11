import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CircleDot } from "lucide-react";
import { ErrorState } from "@/components/feedback/states";
import { Badge } from "@/components/ui/card";
import { IssueCommentBox, IssueControls } from "@/features/issues/issue-controls";
import { IssueThread } from "@/features/issues/issue-thread";
import { relativeTime } from "@/lib/format";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { IssueService } from "@/server/services/issue-service";

export default async function IssuePage({ params }: { params: Promise<{ owner: string; repo: string; number: string }> }) {
  const { owner, repo, number } = await params;
  const id = Number(number);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  let data: Awaited<ReturnType<IssueService["detail"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new IssueService(new GitHubClient(accessToken, crypto.randomUUID())).detail(owner, repo, id);
  } catch {
    return <ErrorState message="This issue could not be loaded from GitHub."/>;
  }
  if (!data) return <ErrorState message="This issue could not be loaded from GitHub."/>;
  if (data.issue.isPullRequest) redirect(`../pulls/${data.issue.number}`);
  const issue = data.issue;
  return <article className="feature-stack">
    <header className="section-heading">
      <div>
        <span className="eyebrow">Issue #{issue.number}</span>
        <h1>{issue.title}</h1>
        <div className="issue-meta">
          <Badge tone={issue.state === "open" ? "success" : "danger"}>{issue.state === "open" ? <CircleDot/> : <CheckCircle2/>}{issue.state}</Badge>
          <span>{issue.user.login} opened {relativeTime(issue.createdAt)}</span>
          {issue.updatedAt !== issue.createdAt ? <span>updated {relativeTime(issue.updatedAt)}</span> : null}
        </div>
      </div>
    </header>
    {issue.labels.length ? <div className="row-actions">{issue.labels.map((label) => <span className="label-chip" key={label.name} style={{ borderColor: label.color ? `#${label.color}` : undefined }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: label.color ? `#${label.color}` : "var(--muted)" }}/>{label.name}</span>)}</div> : null}
    <section className="thread-comment">
      <header className="thread-head"><strong>{issue.user.login}</strong><span>opened this issue {relativeTime(issue.createdAt)}</span></header>
      <div className="thread-body" style={{ whiteSpace: "pre-wrap" }}>{issue.body || "No description provided."}</div>
    </section>
    <IssueThread comments={data.comments}/>
    <IssueControls owner={owner} repo={repo} issue={issue}/>
    <IssueCommentBox owner={owner} repo={repo} number={issue.number}/>
  </article>;
}
