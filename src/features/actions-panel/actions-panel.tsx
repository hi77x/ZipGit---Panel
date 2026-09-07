"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDot, ExternalLink, Play, RotateCcw, Square } from "lucide-react";
import { apiRequest } from "@/features/api-client";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Spinner } from "@/components/feedback/states";
import { useToast } from "@/components/feedback/toast-provider";

type Workflow = { id: number; name: string; path: string; state: string; html_url: string; dispatchable: boolean | null };
type Run = { id: number; name?: string | null; status: string | null; conclusion: string | null; event: string; head_branch: string | null; head_sha: string; html_url: string; created_at: string; actor?: { login?: string } | null; workflow_id: number; canCancel: boolean; canRerun: boolean };

export function ActionsPanel({ owner, repo, defaultBranch }: { owner: string; repo: string; defaultBranch: string }) {
  const base = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions`;
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null), [runs, setRuns] = useState<Run[] | null>(null), [error, setError] = useState(""), [pending, setPending] = useState<number | null>(null), [ref, setRef] = useState(defaultBranch);
  const toast = useToast();
  const load = useCallback(async () => {
    try {
      const [workflowData, runData] = await Promise.all([apiRequest<{ workflows: Workflow[] }>(`${base}/workflows`), apiRequest<{ runs: Run[] }>(`${base}/runs`)]);
      setWorkflows(workflowData.workflows); setRuns(runData.runs); setError("");
    } catch (unknownError) { setError(unknownError instanceof Error ? unknownError.message : "Actions could not be loaded."); }
  }, [base]);
  useEffect(() => {
    let live = true;
    Promise.all([apiRequest<{ workflows: Workflow[] }>(`${base}/workflows`), apiRequest<{ runs: Run[] }>(`${base}/runs`)]).then(([workflowData, runData]) => {
      if (live) { setWorkflows(workflowData.workflows); setRuns(runData.runs); }
    }).catch((unknownError) => { if (live) setError(unknownError instanceof Error ? unknownError.message : "Actions could not be loaded."); });
    return () => { live = false; };
  }, [base]);
  const active = useMemo(() => runs?.some((run) => run.status === "queued" || run.status === "in_progress") ?? false, [runs]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5_000);
    return () => window.clearInterval(timer);
  }, [active, load]);
  async function dispatch(id: number) {
    setPending(id);
    try { await apiRequest(`${base}/workflows/${id}/dispatch`, { method: "POST", body: JSON.stringify({ ref, inputs: {} }) }); toast("Workflow dispatch accepted."); window.setTimeout(() => void load(), 1500); }
    catch (unknownError) { setError(unknownError instanceof Error ? unknownError.message : "Dispatch failed."); }
    finally { setPending(null); }
  }
  async function runAction(id: number, action: "cancel" | "rerun" | "rerun-failed") {
    setPending(id);
    try { const result = await apiRequest<{ stale: boolean }>(`${base}/runs/${id}`, { method: "POST", body: JSON.stringify({ action }) }); toast(result.stale ? "Run already changed; the list was refreshed." : "Workflow action accepted."); await load(); }
    catch (unknownError) { setError(unknownError instanceof Error ? unknownError.message : "Run action failed."); }
    finally { setPending(null); }
  }
  if (!workflows && !runs && !error) return <Spinner label="Loading GitHub Actions"/>;
  return <div className="feature-stack">{error ? <ErrorState message={error}/> : null}<Card><div className="section-heading"><div><h2>Workflows</h2><p>Manual dispatch is available only when the workflow declares workflow_dispatch.</p></div><label className="compact-field">Dispatch ref<input value={ref} onChange={(event) => setRef(event.target.value)}/></label></div>{workflows?.length ? <div className="workflow-list">{workflows.map((workflow) => <article key={workflow.id}><div><a href={workflow.html_url} target="_blank" rel="noopener noreferrer">{workflow.name} <ExternalLink/></a><code>{workflow.path}</code></div><Badge tone={workflow.state === "active" ? "success" : "warning"}>{workflow.state}</Badge>{workflow.dispatchable ? <Button loading={pending === workflow.id} onClick={() => void dispatch(workflow.id)}><Play/> Dispatch</Button> : <Badge>{workflow.dispatchable === false ? "No manual trigger" : "Trigger unknown"}</Badge>}</article>)}</div> : <EmptyState title="No workflows" message="This repository has no workflows available through GitHub Actions."/>}</Card>
    <Card><h2>Workflow runs</h2>{runs?.length ? <div className="table-scroll"><table><thead><tr><th>Run</th><th>Status</th><th>Branch / commit</th><th>Actor</th><th>Created</th><th>Actions</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td><a href={run.html_url} target="_blank" rel="noopener noreferrer">{run.name || `Run #${run.id}`}</a><small>{run.event}</small></td><td><Badge tone={run.conclusion === "success" ? "success" : run.status === "completed" ? "danger" : "warning"}><CircleDot/>{run.conclusion ?? run.status ?? "unknown"}</Badge></td><td><span>{run.head_branch ?? "detached"}</span><code>{run.head_sha.slice(0, 7)}</code></td><td>{run.actor?.login ?? "GitHub user"}</td><td>{new Date(run.created_at).toLocaleString()}</td><td><div className="row-actions">{run.canCancel ? <Button loading={pending === run.id} onClick={() => void runAction(run.id, "cancel")}><Square/> Cancel</Button> : null}{run.canRerun ? <Button loading={pending === run.id} onClick={() => void runAction(run.id, "rerun")}><RotateCcw/> Re-run</Button> : null}</div></td></tr>)}</tbody></table></div> : <EmptyState title="No workflow runs" message="No runs have been reported for this repository."/>}</Card>
  </div>;
}
