"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import type { IssueDetailDto } from "@/shared/contracts/issues";

function parseList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function IssueForm({ owner, repo, mode = "create" }: { owner: string; repo: string; mode?: "create" }) {
  const [title, setTitle] = useState(""), [body, setBody] = useState(""), [labels, setLabels] = useState(""), [assignees, setAssignees] = useState("");
  const [pending, setPending] = useState(false), [errors, setErrors] = useState<Record<string, string>>({}), [message, setMessage] = useState("");
  const toast = useToast();
  const router = useRouter();
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setMessage("");
    setPending(true);
    try {
      const issueLabels = parseList(labels), issueAssignees = parseList(assignees);
      const issue = await apiRequest<IssueDetailDto>(`/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body, ...(issueLabels.length ? { labels: issueLabels } : {}), ...(issueAssignees.length ? { assignees: issueAssignees } : {}) })
      });
      toast("Issue created.");
      router.push(`${base}/${issue.number}`);
      router.refresh();
    } catch (unknownError) {
      const failure = unknownError as { message?: string; fieldErrors?: Record<string, string> };
      setErrors(failure.fieldErrors ?? {});
      setMessage(failure.message ?? "The issue could not be created.");
    } finally {
      setPending(false);
    }
  }
  return <form className="feature-stack" onSubmit={submit}>
    <Card>
      <h2>{mode === "create" ? "New issue" : "Update issue"}</h2>
      {message ? <div className="inline-error">{message}</div> : null}
      <div className="form-grid">
        <label className={`field full-field ${errors.title ? "field-invalid" : ""}`}><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={256} required autoFocus/>{errors.title ? <small className="field-error">{errors.title}</small> : null}</label>
        <label className={`field full-field ${errors.body ? "field-invalid" : ""}`}><span>Description</span><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} maxLength={65536} placeholder="Describe the issue"/>{errors.body ? <small className="field-error">{errors.body}</small> : null}</label>
        <label className={`field ${errors.labels ? "field-invalid" : ""}`}><span>Labels</span><input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="bug, enhancement"/><small>Comma separated, up to 20</small>{errors.labels ? <small className="field-error">{errors.labels}</small> : null}</label>
        <label className={`field ${errors.assignees ? "field-invalid" : ""}`}><span>Assignees</span><input value={assignees} onChange={(event) => setAssignees(event.target.value)} placeholder="octocat, hubot"/><small>Comma separated GitHub logins, up to 10</small>{errors.assignees ? <small className="field-error">{errors.assignees}</small> : null}</label>
      </div>
      <div className="button-row"><Button type="submit" variant="primary" loading={pending} disabled={!title.trim()}><Plus/> Create issue</Button><ButtonLink href={base}>Cancel</ButtonLink></div>
    </Card>
  </form>;
}
