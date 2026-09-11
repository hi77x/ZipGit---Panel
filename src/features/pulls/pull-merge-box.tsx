"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, GitMerge, GitPullRequestClosed, GitPullRequestDraft, LoaderCircle, LockOpen, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import { relativeTime } from "@/lib/format";
import type { MergeMethod, MergeResultDto, PullDetailDto } from "@/shared/contracts/pulls";

const methods: Array<{ value: MergeMethod; label: string; action: string; hint: string }> = [
  { value: "merge", label: "Merge commit", action: "Merge pull request", hint: "All commits from the head branch are added to the base branch with a merge commit." },
  { value: "squash", label: "Squash", action: "Squash and merge", hint: "All commits are combined into a single commit on the base branch." },
  { value: "rebase", label: "Rebase", action: "Rebase and merge", hint: "Commits are replayed onto the base branch without a merge commit." }
];

const mergeableLabels: Record<string, string> = {
  clean: "Ready to merge", unstable: "Checks are still running", blocked: "Blocked by required reviews or checks",
  behind: "The head branch is behind the base branch", dirty: "Conflicts with the base branch",
  has_hooks: "Pre-receive hooks must pass", unknown: "GitHub has not finished computing mergeability"
};

export function PullMergeBox({ owner, repo, pull }: { owner: string; repo: string; pull: PullDetailDto }) {
  const [method, setMethod] = useState<MergeMethod>("merge"), [deleteBranch, setDeleteBranch] = useState(true), [commitTitle, setCommitTitle] = useState(""), [commitMessage, setCommitMessage] = useState("");
  const [pending, setPending] = useState<"merge" | "state" | null>(null), [error, setError] = useState(""), [merged, setMerged] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pull.number}`;
  const isMerged = merged || pull.merged;
  const disabled = isMerged || pull.state === "closed" || pull.draft || pull.mergeable === false;
  const activeMethod = useMemo(() => methods.find((item) => item.value === method) ?? methods[0], [method]);
  async function merge() {
    setPending("merge"); setError("");
    try {
      const result = await apiRequest<MergeResultDto>(`${endpoint}/merge`, {
        method: "POST",
        body: JSON.stringify({ method, commitTitle: commitTitle.trim() || undefined, commitMessage: commitMessage.trim() || undefined, deleteBranch })
      });
      setMerged(result.merged);
      toast(result.merged ? result.message || "Pull request merged." : result.message || "GitHub did not complete the merge.", result.merged ? "success" : "error");
      if (result.merged) router.refresh();
      else setError(result.message || "GitHub did not complete the merge.");
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "The merge could not be completed.");
    } finally {
      setPending(null);
    }
  }
  async function toggleState() {
    setPending("state"); setError("");
    try {
      const state = pull.state === "open" ? "closed" : "open";
      await apiRequest<PullDetailDto>(endpoint, { method: "PATCH", body: JSON.stringify({ state }) });
      toast(state === "closed" ? "Pull request closed." : "Pull request reopened.");
      router.refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "The pull request state could not be changed.");
    } finally {
      setPending(null);
    }
  }
  return <section className="pr-merge-box">
    <div className="merge-status">
      {isMerged ? <GitMerge className="state-icon state-merged" aria-hidden="true"/> : pull.state === "closed" ? <GitPullRequestClosed className="state-icon state-closed" aria-hidden="true"/> : pull.draft ? <GitPullRequestDraft className="state-icon state-draft" aria-hidden="true"/> : pull.mergeable === false ? <XCircle className="state-icon state-closed" aria-hidden="true"/> : pull.mergeable === true ? <CheckCircle2 className="state-icon state-open" aria-hidden="true"/> : <LoaderCircle className="state-icon spin" aria-hidden="true"/>}
      <span>{statusText(isMerged, pull)}</span>
    </div>
    {error ? <p className="inline-error">{error}</p> : null}
    {isMerged ? <div className="inline-success">{pull.mergedAt ? `Merged ${relativeTime(pull.mergedAt)}.` : "This pull request was merged."}{pull.mergedBy ? ` Merged by ${pull.mergedBy.login}.` : ""}</div> : null}
    {!isMerged && pull.state === "open" ? <>
      {pull.mergeable === false ? <div className="inline-warning"><AlertTriangle style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }} aria-hidden="true"/>This branch has conflicts that must be resolved before merging.</div> : null}
      <div>
        <span className="field-label">Merge method</span>
        <div className="filter-chips" role="group" aria-label="Merge method" style={{ paddingTop: 6 }}>
          {methods.map((item) => <button key={item.value} type="button" className={method === item.value ? "chip-active" : ""} aria-pressed={method === item.value} disabled={pending !== null} onClick={() => setMethod(item.value)}>{item.label}</button>)}
        </div>
        <p className="muted text-xs">{activeMethod?.hint}</p>
      </div>
      <label className="field"><span>Commit title (optional)</span><input value={commitTitle} maxLength={256} disabled={pending !== null} placeholder="Leave blank for GitHub's default" onChange={(event) => setCommitTitle(event.target.value)}/></label>
      <label className="field"><span>Commit message (optional)</span><textarea value={commitMessage} maxLength={65536} rows={3} disabled={pending !== null} onChange={(event) => setCommitMessage(event.target.value)}/></label>
      <label className="cluster" style={{ gap: 8, fontSize: ".82rem" }}><input type="checkbox" checked={deleteBranch} disabled={pending !== null} onChange={(event) => setDeleteBranch(event.target.checked)}/>Delete the head branch after merging</label>
      <Button variant="primary" loading={pending === "merge"} disabled={disabled} onClick={() => void merge()}><GitMerge/> {activeMethod?.action ?? "Merge pull request"}</Button>
      {pull.draft ? <p className="muted text-xs">Mark this draft as ready for review before merging.</p> : null}
      <Button variant="danger" loading={pending === "state"} disabled={pending === "merge"} onClick={() => void toggleState()}><GitPullRequestClosed/> Close pull request</Button>
    </> : null}
    {!isMerged && pull.state === "closed" ? <Button variant="primary" loading={pending === "state"} disabled={pending === "merge"} onClick={() => void toggleState()}><LockOpen/> Reopen pull request</Button> : null}
  </section>;
}

function statusText(isMerged: boolean, pull: PullDetailDto): string {
  if (isMerged) return pull.mergedAt ? `Merged ${relativeTime(pull.mergedAt)}` : "Merged";
  if (pull.state === "closed") return "Closed without merging";
  if (pull.draft) return "Draft · not ready to merge";
  if (pull.mergeable === false) return "Conflicts with the base branch";
  if (pull.mergeable === true) return mergeableLabels[pull.mergeableState ?? "clean"] ?? "Ready to merge";
  return mergeableLabels[pull.mergeableState ?? "unknown"] ?? "Checking mergeability";
}
