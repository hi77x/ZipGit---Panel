"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquare, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import { relativeTime } from "@/lib/format";
import type { ActorDto, IssueCommentDto } from "@/shared/contracts/issues";
import type { PullDetailDto, PullReviewDto } from "@/shared/contracts/pulls";

type CommentMode = "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
type TimelineEntry =
  | { kind: "comment"; key: string; actor: ActorDto; body: string; createdAt: string; edited: boolean }
  | { kind: "review"; key: string; actor: ActorDto; body: string; createdAt: string; state: string };

export function PullThread({ owner, repo, number, pull, reviews, comments }: {
  owner: string;
  repo: string;
  number: number;
  pull: PullDetailDto;
  reviews: PullReviewDto[];
  comments: IssueCommentDto[];
}) {
  const [body, setBody] = useState(""), [mode, setMode] = useState<CommentMode>("COMMENT"), [pending, setPending] = useState(false), [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();
  const locked = pull.merged || pull.state === "closed";
  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [
      ...comments.map((comment) => ({
        kind: "comment" as const, key: `comment-${comment.id}`, actor: comment.user, body: comment.body,
        createdAt: comment.createdAt, edited: Boolean(comment.updatedAt && comment.updatedAt !== comment.createdAt)
      })),
      ...reviews.filter((review) => review.submittedAt).map((review) => ({
        kind: "review" as const, key: `review-${review.id}`, actor: review.user, body: review.body,
        createdAt: review.submittedAt ?? "", state: review.state
      }))
    ];
    return entries.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }, [comments, reviews]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) { setError("Enter a comment before submitting."); return; }
    setPending(true); setError("");
    try {
      const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/comments`;
      const result = await apiRequest<{ comment?: IssueCommentDto; review?: PullReviewDto }>(endpoint, {
        method: "POST", body: JSON.stringify({ body, event: mode === "COMMENT" ? undefined : mode })
      });
      setBody("");
      toast(result.review ? "Review submitted." : "Comment posted.");
      router.refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "The comment could not be submitted.");
    } finally {
      setPending(false);
    }
  }
  return <div className="feature-stack">
    <div className="thread">
      <article className="thread-comment">
        <header className="thread-head"><strong>{pull.user.login}</strong><span>opened this pull request</span><time dateTime={pull.createdAt}>{relativeTime(pull.createdAt)}</time></header>
        <div className="thread-body" style={{ whiteSpace: "pre-wrap" }}>{pull.body || "No description provided."}</div>
      </article>
      {timeline.map((entry) => <article className="thread-comment" key={entry.key}>
        <header className="thread-head">
          {entry.kind === "review" ? reviewIcon(entry.state) : <MessageSquare className="state-icon muted" aria-hidden="true"/>}
          <strong>{entry.actor.login}</strong>
          <span>{entry.kind === "review" ? reviewLabel(entry.state) : "commented"}</span>
          <time dateTime={entry.createdAt}>{relativeTime(entry.createdAt)}</time>
          {entry.kind === "comment" && entry.edited ? <span className="muted">edited</span> : null}
        </header>
        {entry.body ? <div className="thread-body" style={{ whiteSpace: "pre-wrap" }}>{entry.body}</div> : null}
      </article>)}
    </div>
    {locked ? <div className="inline-warning">This pull request is {pull.merged ? "merged" : "closed"}. Reopen it to comment or review.</div> : null}
    <form className="comment-box" onSubmit={submit}>
      <div className="filter-chips" role="tablist" aria-label="Comment type">
        {modes.map((item) => <button key={item.value} type="button" role="tab" aria-selected={mode === item.value} className={mode === item.value ? "chip-active" : ""} disabled={pending || locked} onClick={() => { setMode(item.value); setError(""); }}>
          {item.icon}{item.label}
        </button>)}
      </div>
      <textarea value={body} maxLength={65536} disabled={pending || locked} placeholder={mode === "COMMENT" ? "Write a comment" : mode === "APPROVE" ? "Add an optional note to your approval" : "Explain what needs to change"} onChange={(event) => setBody(event.target.value)}/>
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="row-actions">
        <Button type="submit" variant="primary" loading={pending} disabled={locked}><Send/> {mode === "COMMENT" ? "Comment" : mode === "APPROVE" ? "Approve" : "Request changes"}</Button>
      </div>
    </form>
  </div>;
}

const modes: Array<{ value: CommentMode; label: string; icon: React.ReactNode }> = [
  { value: "COMMENT", label: "Comment", icon: <MessageSquare style={{ width: 14, height: 14 }} aria-hidden="true"/> },
  { value: "APPROVE", label: "Approve", icon: <CheckCircle2 style={{ width: 14, height: 14 }} aria-hidden="true"/> },
  { value: "REQUEST_CHANGES", label: "Request changes", icon: <XCircle style={{ width: 14, height: 14 }} aria-hidden="true"/> }
];

function reviewLabel(state: string): string {
  if (state === "APPROVED") return "approved these changes";
  if (state === "CHANGES_REQUESTED") return "requested changes";
  if (state === "DISMISSED") return "had a review dismissed";
  return "reviewed";
}

function reviewIcon(state: string) {
  if (state === "APPROVED") return <CheckCircle2 className="state-icon state-open" aria-hidden="true"/>;
  if (state === "CHANGES_REQUESTED") return <XCircle className="state-icon state-closed" aria-hidden="true"/>;
  return <MessageSquare className="state-icon state-draft" aria-hidden="true"/>;
}
