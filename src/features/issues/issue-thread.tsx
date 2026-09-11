import Image from "next/image";
import { relativeTime } from "@/lib/format";
import type { IssueCommentDto } from "@/shared/contracts/issues";

export function IssueThread({ comments }: { comments: IssueCommentDto[] }) {
  if (!comments.length) return <p className="muted">No comments yet.</p>;
  return <div className="thread">{comments.map((comment) => (
    <article className="thread-comment" key={comment.id}>
      <header className="thread-head">
        {comment.user.avatarUrl ? <Image className="avatar avatar-sm" src={comment.user.avatarUrl} alt="" width={24} height={24}/> : null}
        <strong>{comment.user.login}</strong>
        <span>commented {relativeTime(comment.createdAt)}</span>
        {comment.updatedAt ? <span>edited {relativeTime(comment.updatedAt)}</span> : null}
      </header>
      <div className="thread-body" style={{ whiteSpace: "pre-wrap" }}>{comment.body || "No comment text."}</div>
    </article>
  ))}</div>;
}
