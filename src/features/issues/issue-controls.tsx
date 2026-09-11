"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDot, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import type { IssueCommentDto, IssueSummaryDto, UpdateIssueInput } from "@/shared/contracts/issues";

export function IssueControls({ owner, repo, issue }: { owner: string; repo: string; issue: IssueSummaryDto }) {
  const [pending, setPending] = useState(false), [reason, setReason] = useState<"completed" | "not_planned">("completed"), [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();
  const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issue.number}`;
  async function update(input: UpdateIssueInput) {
    setPending(true);
    setError("");
    try {
      await apiRequest(endpoint, { method: "PATCH", body: JSON.stringify(input) });
      toast(input.state === "closed" ? "Issue closed." : "Issue reopened.");
      router.refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "The issue could not be updated.");
    } finally {
      setPending(false);
    }
  }
  return <div className="button-row">
    {error ? <span className="field-error">{error}</span> : null}
    {issue.state === "open" ? <>
      <label className="compact-field"><span className="field-label">Close reason</span><select value={reason} onChange={(event) => setReason(event.target.value as "completed" | "not_planned")}><option value="completed">Completed</option><option value="not_planned">Not planned</option></select></label>
      <Button variant="danger" loading={pending} onClick={() => void update({ state: "closed", state_reason: reason })}><CheckCircle2/> Close issue</Button>
    </> : <Button variant="success" loading={pending} onClick={() => void update({ state: "open", state_reason: "reopened" })}><CircleDot/> Reopen issue</Button>}
  </div>;
}

export function IssueCommentBox({ owner, repo, number }: { owner: string; repo: string; number: number }) {
  const [body, setBody] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError("");
    try {
      await apiRequest<IssueCommentDto>(`/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      toast("Comment posted.");
      router.refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "The comment could not be posted.");
    } finally {
      setPending(false);
    }
  }
  return <form className="comment-box" onSubmit={submit}>
    <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={65536} placeholder="Leave a comment" aria-label="Comment"/>
    {error ? <span className="field-error">{error}</span> : null}
    <div className="button-row"><Button type="submit" variant="primary" loading={pending} disabled={!body.trim()}><MessageSquare/> Comment</Button></div>
  </form>;
}
