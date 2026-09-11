"use client";
import { useEffect, useRef, useState } from "react";
import { Archive, CheckCircle2, ExternalLink, FileArchive, ShieldAlert, UploadCloud } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { ErrorState, Spinner } from "@/components/feedback/states";
import { apiRequest } from "@/features/api-client";
import type { ApiResponse } from "@/shared/contracts/api-error";
import type { ImportResult } from "@/shared/contracts/import";

type Owner = { login: string; type: "user" | "organization"; avatarUrl: string | null };
const generated = [".git/**", "node_modules/**", ".next/**", "dist/**", "build/**", "coverage/**", ".turbo/**", ".cache/**", "*.log", ".DS_Store", "Thumbs.db"];

export function ImportForm() {
  const [owners, setOwners] = useState<Owner[] | null>(null), [owner, setOwner] = useState(""), [file, setFile] = useState<File | null>(null), [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0), [stage, setStage] = useState(""), [error, setError] = useState(""), [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}), [partial, setPartial] = useState<Record<string, string | number | boolean | null> | null>(null), [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { apiRequest<{ owners: Owner[] }>("/api/github/owners").then((data) => { setOwners(data.owners); if (data.owners[0]) setOwner(`${data.owners[0].type}:${data.owners[0].login}`); }).catch((unknownError) => setError(unknownError instanceof Error ? unknownError.message : "Owners could not be loaded.")); }, []);
  function choose(next: File | null) {
    setError(""); setFieldErrors({}); setPartial(null); setResult(null);
    if (!next) return setFile(null);
    if (!next.name.toLowerCase().endsWith(".zip")) return setError("Choose a .zip archive.");
    if (next.size > 100 * 1024 * 1024) return setError("ZIP exceeds the 100 MiB upload limit.");
    setFile(next);
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setFieldErrors({}); setPartial(null); setResult(null);
    if (!file) return setError("Choose a ZIP archive before importing.");
    const form = new FormData(event.currentTarget);
    const [ownerType, ownerLogin] = owner.split(":", 2);
    form.set("archive", file); form.set("owner", ownerLogin ?? ""); form.set("ownerType", ownerType ?? "user");
    form.set("stripSingleRoot", form.has("stripSingleRoot") ? "true" : "false"); form.set("excludeGenerated", form.has("excludeGenerated") ? "true" : "false");
    const xhr = new XMLHttpRequest();
    setStage("Uploading archive"); setProgress(0);
    xhr.upload.onprogress = (upload) => { if (upload.lengthComputable) setProgress(Math.round(upload.loaded / upload.total * 100)); };
    xhr.upload.onload = () => { setStage("Validating ZIP and creating Git objects"); setProgress(100); };
    xhr.onload = () => {
      setStage("");
      try {
        const payload = JSON.parse(xhr.responseText) as ApiResponse<ImportResult>;
        if (payload.ok) setResult(payload.data);
        else { setError(payload.error.message); setFieldErrors(payload.error.fieldErrors); if (payload.error.code === "IMPORT_PARTIALLY_COMPLETED") setPartial(payload.error.details ?? null); }
      } catch { setError("The import endpoint returned an unreadable response."); }
    };
    xhr.onerror = () => { setStage(""); setError("Network connection was interrupted during import."); };
    xhr.open("POST", "/api/imports"); xhr.send(form);
  }
  if (!owners && !error) return <Spinner label="Loading available GitHub owners"/>;
  if (result) return <ImportSuccess result={result} onReset={() => { setResult(null); setFile(null); setProgress(0); }}/>
  return <form className="import-layout" onSubmit={submit}><div className="feature-stack"><Card className="import-card"><div className="step-title"><span>1</span><div><h2>Choose archive</h2><p>ZIP only · maximum upload 100 MiB</p></div></div><div className={`dropzone ${drag ? "dropzone-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); choose(event.dataTransfer.files[0] ?? null); }}><FileArchive/><strong>{file ? file.name : "Drop your ZIP here"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MiB` : "or choose it with the system file picker"}</span><Button type="button" onClick={() => inputRef.current?.click()}><UploadCloud/> Choose file</Button><input ref={inputRef} type="file" accept=".zip,application/zip" hidden onChange={(event) => choose(event.target.files?.[0] ?? null)}/></div></Card>
    <Card><div className="step-title"><span>2</span><div><h2>Repository details</h2><p>A new empty repository will be created before the single root commit.</p></div></div><div className="form-grid"><label>Owner<select value={owner} onChange={(event) => setOwner(event.target.value)}>{owners?.map((item) => <option value={`${item.type}:${item.login}`} key={`${item.type}:${item.login}`}>{item.login} · {item.type}</option>)}</select></label><label>Repository name<input name="repositoryName" required maxLength={100} pattern="[A-Za-z0-9._-]+" aria-describedby={fieldErrors.repositoryName ? "repositoryName-error" : undefined}/>{fieldErrors.repositoryName ? <span id="repositoryName-error" className="field-error">{fieldErrors.repositoryName}</span> : null}</label><label className="full-field">Description<textarea name="description" maxLength={350} rows={3}/></label><label>Visibility<select name="visibility" defaultValue="private"><option value="private">Private</option><option value="public">Public</option></select></label><label>Default branch<input name="defaultBranch" defaultValue="main" required/></label><label className="full-field">Commit message<input name="commitMessage" defaultValue="Import project via RepoDeck" required maxLength={500}/></label></div></Card>
    <Card><div className="step-title"><span>3</span><div><h2>Import policy</h2><p>Security checks always run, regardless of optional exclusions.</p></div></div><label className="check-row"><input name="stripSingleRoot" type="checkbox" defaultChecked/><span><strong>Strip a single top-level folder</strong><small>Applied only when every imported file shares that folder.</small></span></label><label className="check-row"><input name="excludeGenerated" type="checkbox" defaultChecked/><span><strong>Exclude dependency and build folders</strong><small>{generated.join(", ")}</small></span></label>{error ? <ErrorState title={partial ? "Repository created; import stopped" : "Import could not start"} message={error}/> : null}{partial?.repositoryUrl && typeof partial.repositoryUrl === "string" ? <div className="button-row"><a className="button button-primary" href={partial.repositoryUrl} target="_blank" rel="noopener noreferrer">Open partial repository <ExternalLink/></a><span>{String(partial.createdBlobCount ?? 0)} / {String(partial.totalBlobCount ?? 0)} blobs uploaded</span></div> : null}{stage ? <div className="upload-progress" aria-live="polite"><div><Spinner label={stage}/><strong>{progress}%</strong></div><progress max="100" value={progress}/><small>After upload, validation and Git object creation are indeterminate because this request has no persisted job stream.</small></div> : null}<Button className="import-submit" variant="primary" type="submit" loading={Boolean(stage)} disabled={!file}><Archive/> Validate and import</Button></Card></div>
    <aside><Card className="security-card"><ShieldAlert/><h2>Blocked before GitHub</h2><ul><li>Path traversal, absolute paths, and collisions</li><li>Encrypted ZIP entries, symlinks, and special files</li><li><code>.env*</code>, private keys, and credential files</li><li>More than 5,000 files or 250 MiB unpacked</li><li>Single files above 50 MiB—use Git LFS separately</li></ul></Card></aside></form>;
}

function ImportSuccess({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  const [owner, repo] = result.fullName.split("/");
  return <Card className="success-panel"><CheckCircle2/><Badge tone="success">Import completed</Badge><h1>{result.fullName}</h1><p>{result.importedFileCount} files were written in one root commit. {result.excluded.length} generated files were excluded.</p><dl className="detail-list"><div><dt>Commit</dt><dd><code>{result.commitSha.slice(0, 12)}</code></dd></div><div><dt>Single root stripped</dt><dd>{result.singleRootDetected ? "Yes" : "No"}</dd></div><div><dt>Empty folders skipped</dt><dd>{result.emptyDirectoryCount}</dd></div></dl>{result.excluded.length ? <details><summary>Excluded files ({result.excluded.length})</summary><ul>{result.excluded.map((item) => <li key={item.path}><code>{item.path}</code> — {item.reason}</li>)}</ul></details> : null}<div className="button-row"><a className="button button-primary" href={result.repositoryUrl} target="_blank" rel="noopener noreferrer">Open on GitHub <ExternalLink/></a><ButtonLink href={`/repositories/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(repo ?? "")}`}>Open in RepoDeck</ButtonLink><Button onClick={onReset}>Import another</Button></div></Card>;
}
