"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, ExternalLink, FileArchive, ShieldAlert, UploadCloud, XCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, Panel, PanelBody, PanelHead } from "@/components/ui/card";
import { ErrorState, Spinner } from "@/components/feedback/states";
import { apiRequest } from "@/features/api-client";
import type { ApiResponse } from "@/shared/contracts/api-error";
import type { ImportFindingSummary, ImportOutcome } from "@/shared/contracts/import";

type Owner = { login: string; type: "user" | "organization"; avatarUrl: string | null };
const generated = [".git/**", "node_modules/**", ".next/**", "dist/**", "build/**", "coverage/**", ".turbo/**", ".cache/**", "*.log", ".DS_Store", "Thumbs.db"];

export function ImportForm() {
  const [owners, setOwners] = useState<Owner[] | null>(null), [owner, setOwner] = useState(""), [file, setFile] = useState<File | null>(null), [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0), [stage, setStage] = useState(""), [error, setError] = useState(""), [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}), [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { apiRequest<{ owners: Owner[] }>("/api/github/owners").then((data) => { setOwners(data.owners); if (data.owners[0]) setOwner(`${data.owners[0].type}:${data.owners[0].login}`); }).catch((unknownError) => setError(unknownError instanceof Error ? unknownError.message : "Owners could not be loaded.")); }, []);
  function choose(next: File | null) {
    setError(""); setFieldErrors({}); setOutcome(null);
    if (!next) return setFile(null);
    if (!next.name.toLowerCase().endsWith(".zip")) return setError("Choose a .zip archive.");
    if (next.size > 100 * 1024 * 1024) return setError("ZIP exceeds the 100 MiB upload limit.");
    setFile(next);
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setFieldErrors({}); setOutcome(null);
    if (!file) return setError("Choose a ZIP archive before importing.");
    const form = new FormData(event.currentTarget);
    const [ownerType, ownerLogin] = owner.split(":", 2);
    form.set("archive", file); form.set("owner", ownerLogin ?? ""); form.set("ownerType", ownerType ?? "user");
    form.set("stripSingleRoot", form.has("stripSingleRoot") ? "true" : "false"); form.set("excludeGenerated", form.has("excludeGenerated") ? "true" : "false");
    const xhr = new XMLHttpRequest();
    setStage("Uploading archive"); setProgress(0);
    xhr.upload.onprogress = (upload) => { if (upload.lengthComputable) setProgress(Math.round(upload.loaded / upload.total * 100)); };
    xhr.upload.onload = () => { setStage("Scanning, validating, and writing Git objects"); setProgress(100); };
    xhr.onload = () => {
      setStage("");
      try {
        const payload = JSON.parse(xhr.responseText) as ApiResponse<ImportOutcome>;
        if (payload.ok) setOutcome(payload.data);
        else { setError(payload.error.message); setFieldErrors(payload.error.fieldErrors); }
      } catch { setError("The import endpoint returned an unreadable response."); }
    };
    xhr.onerror = () => { setStage(""); setError("Network connection was interrupted during import."); };
    xhr.open("POST", "/api/imports"); xhr.send(form);
  }
  if (!owners && !error) return <Spinner label="Loading available GitHub owners"/>;
  if (outcome?.status === "completed") return <ImportSuccess outcome={outcome} onReset={() => { setOutcome(null); setFile(null); setProgress(0); }}/>;
  if (outcome) return <ImportNotice outcome={outcome} onReset={() => { setOutcome(null); setFile(null); setProgress(0); }}/>;
  return <form className="import-layout" onSubmit={submit}><div className="feature-stack"><Card className="import-card"><div className="step-title"><span>1</span><div><h2>Choose archive</h2><p>ZIP only · maximum upload 100 MiB</p></div></div><div className={`dropzone ${drag ? "dropzone-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); choose(event.dataTransfer.files[0] ?? null); }}><FileArchive/><strong>{file ? file.name : "Drop your ZIP here"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MiB` : "or choose it with the system file picker"}</span><Button type="button" onClick={() => inputRef.current?.click()}><UploadCloud/> Choose file</Button><input ref={inputRef} type="file" accept=".zip,application/zip" hidden onChange={(event) => choose(event.target.files?.[0] ?? null)}/></div></Card>
    <Card><div className="step-title"><span>2</span><div><h2>Repository details</h2><p>A new empty repository is created, then the branch is published only after every Git object exists.</p></div></div><div className="form-grid"><label>Owner<select value={owner} onChange={(event) => setOwner(event.target.value)}>{owners?.map((item) => <option value={`${item.type}:${item.login}`} key={`${item.type}:${item.login}`}>{item.login} · {item.type}</option>)}</select></label><label>Repository name<input name="repositoryName" required maxLength={100} pattern="[A-Za-z0-9._-]+" aria-describedby={fieldErrors.repositoryName ? "repositoryName-error" : undefined}/>{fieldErrors.repositoryName ? <span id="repositoryName-error" className="field-error">{fieldErrors.repositoryName}</span> : null}</label><label className="full-field">Description<textarea name="description" maxLength={350} rows={3}/></label><label>Visibility<select name="visibility" defaultValue="private"><option value="private">Private</option><option value="public">Public</option></select></label><label>Default branch<input name="defaultBranch" defaultValue="main" required/></label><label className="full-field">Commit message<input name="commitMessage" defaultValue="Import project via RepoDeck" required maxLength={500}/></label></div></Card>
    <Card><div className="step-title"><span>3</span><div><h2>Import policy</h2><p>Content is scanned for credentials before any GitHub mutation. There is no bypass switch.</p></div></div><label className="check-row"><input name="stripSingleRoot" type="checkbox" defaultChecked/><span><strong>Strip a single top-level folder</strong><small>Applied only when every imported file shares that folder.</small></span></label><label className="check-row"><input name="excludeGenerated" type="checkbox" defaultChecked/><span><strong>Exclude dependency and build folders</strong><small>{generated.join(", ")}</small></span></label>{error ? <ErrorState title="Import could not start" message={error}/> : null}{stage ? <div className="upload-progress" aria-live="polite"><div><Spinner label={stage}/><strong>{progress}%</strong></div><progress max="100" value={progress}/><small>Validation, secret scanning, and Git object creation run after the upload on the server.</small></div> : null}<Button className="import-submit" variant="primary" type="submit" loading={Boolean(stage)} disabled={!file}><Archive/> Validate and import</Button></Card></div>
    <aside><Card className="security-card"><ShieldAlert/><h2>Blocked before GitHub</h2><ul><li>Path traversal, absolute paths, and collisions</li><li>Encrypted ZIP entries, symlinks, and special files</li><li>Credentials found in file contents: cloud keys, tokens, private keys, connection strings</li><li>Credential files that cannot be scanned within the archive budget</li><li>More than 5,000 files or 250 MiB unpacked</li></ul></Card></aside></form>;
}

function ImportSuccess({ outcome, onReset }: { outcome: ImportOutcome; onReset: () => void }) {
  const [owner, repo] = (outcome.repository?.fullName ?? "/").split("/");
  return <Card className="success-panel"><CheckCircle2/><Badge tone="success">Import completed</Badge><h1>{outcome.repository?.fullName}</h1><p>{outcome.importedFileCount} files were written in one root commit. {outcome.excluded.length} generated files were excluded.</p><dl className="detail-list"><div><dt>Commit</dt><dd><code>{outcome.commitSha?.slice(0, 12) ?? "—"}</code></dd></div><div><dt>Single root stripped</dt><dd>{outcome.singleRootDetected ? "Yes" : "No"}</dd></div><div><dt>Empty folders skipped</dt><dd>{outcome.emptyDirectoryCount}</dd></div><div><dt>Operation</dt><dd><code>{outcome.operationId.slice(0, 8)}</code></dd></div></dl>{outcome.scan.truncated ? <div className="inline-warning"><AlertTriangle style={{ width: 15, height: 15, verticalAlign: "-3px", marginRight: 6 }}/>The secret scan was incomplete: {outcome.scan.skippedFiles} file(s) were skipped by the scan budget. This import is not a clean scan result.</div> : null}{outcome.findings.length ? <FindingList findings={outcome.findings} title={`Non-blocking findings (${outcome.findings.length})`}/> : null}{outcome.excluded.length ? <details><summary>Excluded files ({outcome.excluded.length})</summary><ul>{outcome.excluded.map((item) => <li key={item.path}><code>{item.path}</code> — {item.reason}</li>)}</ul></details> : null}<div className="button-row"><a className="button button-primary" href={outcome.repository?.url} target="_blank" rel="noopener noreferrer">Open on GitHub <ExternalLink/></a><ButtonLink href={`/repositories/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(repo ?? "")}`}>Open in RepoDeck</ButtonLink><Button onClick={onReset}>Import another</Button></div></Card>;
}

const outcomeTone = { rejected: "danger", failed: "danger", compensated: "warning", cleanup_incomplete: "warning" } as const;
const outcomeTitle = {
  rejected: "Import blocked before GitHub",
  failed: "Import failed",
  compensated: "Import failed and was rolled back",
  cleanup_incomplete: "Import failed; cleanup is incomplete"
} as const;

function ImportNotice({ outcome, onReset }: { outcome: ImportOutcome; onReset: () => void }) {
  const tone = outcome.status === "cleanup_incomplete" ? "danger" : outcomeTone[outcome.status as keyof typeof outcomeTone] ?? "danger";
  return <div className="feature-stack" style={{ maxWidth: 920, margin: "0 auto" }}>
    <Card>
      <div className="spread" style={{ alignItems: "flex-start" }}><div className="step-title"><span style={{ background: tone === "danger" ? "var(--danger-soft)" : "var(--warning-soft)" }}>{outcome.status === "rejected" ? <ShieldAlert style={{ width: 16, height: 16 }}/> : <XCircle style={{ width: 16, height: 16 }}/>}</span><div><h2 style={{ margin: 0 }}>{outcomeTitle[outcome.status as keyof typeof outcomeTitle] ?? "Import did not complete"}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{outcome.message}</p></div></div><Badge tone={tone}>{outcome.status.replaceAll("_", " ")}</Badge></div>
      <dl className="detail-list"><div><dt>Stopped after stage</dt><dd><code>{outcome.stage}</code></dd></div><div><dt>Operation</dt><dd><code>{outcome.operationId}</code></dd></div><div><dt>Repository created</dt><dd>{outcome.repository ? "Yes" : "No"}</dd></div><div><dt>Branch published</dt><dd>{outcome.cleanup.refDeleted ? "Removed" : outcome.repository && outcome.commitSha ? "May still exist" : "No"}</dd></div></dl>
      {outcome.remediation ? <div className="inline-warning" role="status">{outcome.remediation}</div> : null}
      {outcome.repository ? <div className="button-row"><a className="button" href={outcome.repository.url} target="_blank" rel="noopener noreferrer">Open repository on GitHub <ExternalLink/></a></div> : null}
      <div className="button-row" style={{ marginTop: 16 }}><Button variant="primary" onClick={onReset}><Archive/> Import another archive</Button></div>
    </Card>
    {outcome.findings.length ? <Panel><PanelHead title={`Findings (${outcome.findings.length})`} icon={<ShieldAlert/>}/><PanelBody><FindingList findings={outcome.findings}/></PanelBody></Panel> : null}
    {outcome.scan.truncated ? <div className="inline-warning">The scan was incomplete: {outcome.scan.skippedFiles} file(s) and {outcome.scan.scannedBytes} bytes were scanned. This is not a clean scan result.</div> : null}
  </div>;
}

function FindingList({ findings, title }: { findings: ImportFindingSummary[]; title?: string }) {
  return <div className="stack-sm">{title ? <span className="card-label">{title}</span> : null}{findings.map((finding) => <div className={`finding finding-${finding.severity}`} key={`${finding.ruleId}-${finding.path}-${finding.line}-${finding.masked}`}><div className="finding-head"><Badge tone={finding.severity === "critical" || finding.severity === "high" ? "danger" : finding.severity === "medium" ? "warning" : "neutral"}>{finding.severity}</Badge><span className="finding-title">{finding.name}</span><code className="muted text-xs">{finding.path}{finding.line > 0 ? `:${finding.line}` : ""}</code></div>{finding.masked ? <pre className="finding-snippet">{finding.snippet || finding.masked}</pre> : null}<p className="muted text-xs" style={{ padding: "0 13px 10px", margin: 0 }}>{finding.remediation}</p></div>)}</div>;
}
