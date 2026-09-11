"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import type { BranchDto } from "@/shared/contracts/content";

export function BranchMenu({ owner, repo, current, defaultBranch, branches, onSelect }: {
  owner: string;
  repo: string;
  current: string;
  defaultBranch: string;
  branches: BranchDto[];
  onSelect: (branch: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`;
  const known = branches.some((branch) => branch.name === current);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFieldError("");
    try {
      await apiRequest(endpoint, { method: "POST", body: JSON.stringify({ name, from: current }) });
      toast(`Branch ${name} created.`);
      setCreating(false);
      setName("");
      router.refresh();
      onSelect(name);
    } catch (unknownError) {
      const failure = unknownError as Error & { fieldErrors?: Record<string, string> };
      setError(failure.message);
      setFieldError(failure.fieldErrors?.name ?? failure.fieldErrors?.from ?? "");
    } finally {
      setPending(false);
    }
  }
  return <div className="stack-sm">
    <label className="compact-field">Branch
      <select className="ref-switcher" value={current} onChange={(event) => onSelect(event.target.value)} aria-label="Switch branch">
        {!known ? <option value={current}>{current}</option> : null}
        {branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}{branch.isDefault || branch.name === defaultBranch ? " (default)" : ""}</option>)}
      </select>
    </label>
    {creating ? <form className="stack-sm" onSubmit={create}>
      <label className="compact-field">New branch name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} placeholder="feature/my-change" aria-describedby={fieldError ? "new-branch-error" : undefined}/>{fieldError ? <span id="new-branch-error" className="field-error">{fieldError}</span> : null}</label>
      <div className="button-row">
        <Button type="submit" size="sm" variant="primary" loading={pending}>Create branch</Button>
        <Button type="button" size="sm" onClick={() => { setCreating(false); setError(""); setFieldError(""); }}>Cancel</Button>
      </div>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
    </form> : <Button type="button" size="sm" onClick={() => setCreating(true)} aria-expanded={creating}><GitBranch/> New branch</Button>}
  </div>;
}
