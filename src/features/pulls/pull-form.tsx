"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import type { PullDetailDto } from "@/shared/contracts/pulls";

export function PullForm({ owner, repo, defaultBranch, branches = [] }: { owner: string; repo: string; defaultBranch: string; branches?: string[] }) {
  const [title, setTitle] = useState(""), [body, setBody] = useState(""), [draft, setDraft] = useState(false);
  const [head, setHead] = useState(() => branches.find((branch) => branch !== defaultBranch) ?? branches[0] ?? "");
  const [base, setBase] = useState(() => branches.includes(defaultBranch) ? defaultBranch : branches[0] ?? defaultBranch);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const toast = useToast();
  const router = useRouter();
  const hasBranches = branches.length > 0;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(""); setFieldErrors({});
    try {
      const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
      const result = await apiRequest<PullDetailDto>(endpoint, { method: "POST", body: JSON.stringify({ title: title.trim(), head: head.trim(), base: base.trim(), body, draft }) });
      toast(`Pull request #${result.number} created.`);
      router.push(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${result.number}`);
    } catch (unknownError) {
      const failure = unknownError as { message?: string; fieldErrors?: Record<string, string> };
      setError(failure.message ?? "The pull request could not be created.");
      setFieldErrors(failure.fieldErrors ?? {});
    } finally {
      setPending(false);
    }
  }
  return <Card>
    <h2>Open a pull request</h2>
    <p className="muted">Choose branches, describe the change, and open the request for review.</p>
    {error ? <div className="inline-error">{error}</div> : null}
    <form onSubmit={submit}>
      <div className="form-grid">
        <label className="field full-field"><span>Title</span><input value={title} maxLength={256} required autoFocus aria-invalid={Boolean(fieldErrors.title)} onChange={(event) => setTitle(event.target.value)}/>{fieldErrors.title ? <span className="field-error">{fieldErrors.title}</span> : null}</label>
        <label className="field"><span>Head branch</span>{hasBranches ? <select value={head} onChange={(event) => setHead(event.target.value)}>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select> : <input value={head} maxLength={200} required placeholder="feature/branch or owner:branch" onChange={(event) => setHead(event.target.value)}/>}{fieldErrors.head ? <span className="field-error">{fieldErrors.head}</span> : null}</label>
        <label className="field"><span>Base branch</span>{hasBranches ? <select value={base} onChange={(event) => setBase(event.target.value)}>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select> : <input value={base} maxLength={200} required placeholder={defaultBranch} onChange={(event) => setBase(event.target.value)}/>}{fieldErrors.base ? <span className="field-error">{fieldErrors.base}</span> : null}</label>
        <label className="field full-field"><span>Description</span><textarea value={body} maxLength={65536} rows={10} onChange={(event) => setBody(event.target.value)}/>{fieldErrors.body ? <span className="field-error">{fieldErrors.body}</span> : null}</label>
      </div>
      <label className="check-row"><input type="checkbox" checked={draft} onChange={(event) => setDraft(event.target.checked)}/><span><strong>Create as draft</strong><small>Draft pull requests cannot be merged until marked ready for review.</small></span></label>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <Button type="submit" variant="primary" loading={pending}><GitPullRequest/> Open pull request</Button>
      </div>
    </form>
  </Card>;
}
