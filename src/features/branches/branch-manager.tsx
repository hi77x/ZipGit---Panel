"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranch, GitCompareArrows, Plus, ShieldCheck, Terminal, Trash2 } from "lucide-react";
import { Badge, Panel, PanelHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/states";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import type { BranchDto } from "@/shared/contracts/content";

export function BranchManager({ owner, repo, branches, defaultBranch, canCreate, canDelete }: { owner: string; repo: string; branches: BranchDto[]; defaultBranch: string; canCreate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [from, setFrom] = useState(defaultBranch);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  function create() {
    setError(null);
    startTransition(async () => {
      try {
        await apiRequest(`/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`, { method: "POST", body: JSON.stringify({ name, from }) });
        toast(`Branch ${name} created`, "success");
        setCreating(false);
        setName("");
        router.refresh();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not create the branch.";
        setError(message);
        toast(message, "error");
      }
    });
  }

  function remove(branch: string) {
    if (!window.confirm(`Delete branch “${branch}”? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await apiRequest(`/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`, { method: "DELETE" });
        toast(`Branch ${branch} deleted`, "success");
        router.refresh();
      } catch (caught) {
        toast(caught instanceof Error ? caught.message : "Could not delete the branch.", "error");
      }
    });
  }

  return <Panel>
    <PanelHead title={`${branches.length} branch${branches.length === 1 ? "" : "es"}`} icon={<GitBranch/>} actions={canCreate ? <Button size="sm" variant={creating ? "ghost" : "primary"} onClick={() => setCreating((value) => !value)}>{creating ? "Cancel" : <><Plus/>New branch</>}</Button> : undefined}/>
    {creating && canCreate ? <div className="panel-body" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="form-grid" style={{ margin: 0 }}>
        <label className="field"><span>Branch name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="feature/refactor-auth" autoFocus/></label>
        <label className="field"><span>Create from</span>
          <select value={from} onChange={(event) => setFrom(event.target.value)}>{branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}</select>
        </label>
        {error ? <p className="field-error full-field">{error}</p> : null}
        <div className="full-field row-actions"><Button variant="primary" loading={pending} disabled={!name.trim()} onClick={create}><GitBranch/>Create branch</Button></div>
      </div>
    </div> : null}
    {branches.length ? <div className="table-scroll" style={{ border: 0, borderRadius: 0 }}>
      <table>
        <thead><tr><th>Branch</th><th>Commit</th><th style={{ width: 220 }}>Actions</th></tr></thead>
        <tbody>{branches.map((branch) => <tr key={branch.name}>
          <td>
            <span className="cluster" style={{ gap: 7 }}>
              <GitBranch style={{ width: 15, height: 15, color: "var(--muted)" }}/>
              <Link href={`${base}/code?ref=${encodeURIComponent(branch.name)}`} className="mono" style={{ fontWeight: 600 }}>{branch.name}</Link>
              {branch.isDefault ? <Badge tone="accent"><ShieldCheck/>default</Badge> : null}
              {branch.protected ? <Badge tone="warning">protected</Badge> : null}
            </span>
          </td>
          <td><span className="mono text-xs muted">{branch.sha.slice(0, 7)}</span></td>
          <td>
            <div className="row-actions">
              <Link className="button button-sm" href={`${base}/code?ref=${encodeURIComponent(branch.name)}`}><Terminal/>Code</Link>
              <Link className="button button-sm" href={`${base}/compare?base=${encodeURIComponent(defaultBranch)}&head=${encodeURIComponent(branch.name)}`}><GitCompareArrows/>Compare</Link>
              {!branch.isDefault && canDelete ? <Button size="sm" variant="danger" disabled={pending} onClick={() => remove(branch.name)} aria-label={`Delete ${branch.name}`}><Trash2/>Delete</Button> : null}
            </div>
          </td>
        </tr>)}</tbody>
      </table>
    </div> : <div className="panel-body"><EmptyState title="No branches" message="GitHub returned an empty branch list for this repository."/></div>}
  </Panel>;
}
