"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Globe2, Hammer } from "lucide-react";
import { apiRequest } from "@/features/api-client";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { ErrorState, Spinner } from "@/components/feedback/states";
import { useToast } from "@/components/feedback/toast-provider";

type PageState = {
  status: "disabled" | "configured" | "building" | "deployed" | "failed";
  branches?: string[]; url?: string | null; source?: { branch: string; path: string } | null;
  mode?: string; customDomain?: string | null; httpsEnforced?: boolean; updatedAt?: string | null; error?: string | null;
};

export function PagesPanel({ owner, repo, defaultBranch, isNext }: { owner: string; repo: string; defaultBranch: string; isNext: boolean }) {
  const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`;
  const [state, setState] = useState<PageState | null>(null), [error, setError] = useState(""), [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"branch" | "workflow">(isNext ? "workflow" : "branch"), [branch, setBranch] = useState(defaultBranch), [path, setPath] = useState<"/" | "/docs">("/");
  const toast = useToast();
  useEffect(() => {
    let live = true;
    apiRequest<PageState>(endpoint).then((value) => { if (live) setState(value); }).catch((unknownError) => { if (live) setError(unknownError instanceof Error ? unknownError.message : "Could not load Pages."); });
    return () => { live = false; };
  }, [endpoint]);
  async function configure() {
    setPending(true); setError("");
    try {
      const body = mode === "workflow" ? { mode } : { mode, branch, path };
      const next = await apiRequest<PageState>(endpoint, { method: state?.status === "disabled" ? "POST" : "PATCH", body: JSON.stringify(body) });
      setState(next); toast("GitHub Pages configuration updated.");
    } catch (unknownError) { setError(unknownError instanceof Error ? unknownError.message : "Pages update failed."); }
    finally { setPending(false); }
  }
  async function build() {
    setPending(true);
    try { setState(await apiRequest<PageState>(`${endpoint}/build`, { method: "POST", body: "{}" })); toast("Pages build requested."); }
    catch (unknownError) { setError(unknownError instanceof Error ? unknownError.message : "Build request failed."); }
    finally { setPending(false); }
  }
  if (!state && !error) return <Spinner label="Loading GitHub Pages"/>;
  return <div className="feature-stack">{error ? <ErrorState message={error}/> : null}
    {state?.status === "disabled" ? <Card><Globe2/><h2>GitHub Pages is disabled</h2><p>Choose a deployment source. GitHub permissions and plan rules still apply.</p>{isNext ? <div className="inline-warning">This looks like Next.js. GitHub Pages requires a static export; workflow mode is recommended.</div> : null}<PagesForm mode={mode} setMode={setMode} branch={branch} setBranch={setBranch} path={path} setPath={setPath} branches={state.branches ?? [defaultBranch]}/><Button variant="primary" loading={pending} onClick={configure}>Enable Pages</Button></Card> : null}
    {state && state.status !== "disabled" ? <><Card><div className="feature-title"><Globe2/><div><h2>GitHub Pages</h2><Badge tone={state.status === "deployed" ? "success" : state.status === "failed" ? "danger" : "warning"}>{state.status}</Badge></div></div>{state.url ? <a href={state.url} target="_blank" rel="noopener noreferrer" className="button button-primary">Open site <ExternalLink/></a> : <p>No deployment URL is available yet.</p>}<dl className="detail-list"><div><dt>Source</dt><dd>{state.source ? `${state.source.branch}${state.source.path}` : state.mode ?? "workflow"}</dd></div><div><dt>HTTPS</dt><dd>{state.httpsEnforced ? "Enforced" : "Not reported"}</dd></div>{state.updatedAt ? <div><dt>Last build</dt><dd>{new Date(state.updatedAt).toLocaleString()}</dd></div> : null}</dl>{state.error ? <div className="inline-error">{state.error}</div> : null}{state.mode !== "workflow" ? <Button loading={pending} onClick={build}><Hammer/> Request build</Button> : null}</Card><Card><h2>Change source</h2><PagesForm mode={mode} setMode={setMode} branch={branch} setBranch={setBranch} path={path} setPath={setPath} branches={state.branches ?? [defaultBranch]}/><Button loading={pending} onClick={configure}>Save source</Button></Card></> : null}
  </div>;
}

function PagesForm(props: { mode: "branch" | "workflow"; setMode: (value: "branch" | "workflow") => void; branch: string; setBranch: (value: string) => void; path: "/" | "/docs"; setPath: (value: "/" | "/docs") => void; branches: string[] }) {
  return <div className="form-grid"><label>Deployment mode<select value={props.mode} onChange={(event) => props.setMode(event.target.value as "branch" | "workflow")}><option value="branch">Deploy from a branch</option><option value="workflow">GitHub Actions</option></select></label>{props.mode === "branch" ? <><label>Branch<select value={props.branch} onChange={(event) => props.setBranch(event.target.value)}>{props.branches.map((item) => <option key={item}>{item}</option>)}</select></label><label>Folder<select value={props.path} onChange={(event) => props.setPath(event.target.value as "/" | "/docs")}><option value="/">/ (root)</option><option value="/docs">/docs</option></select></label></> : null}</div>;
}
