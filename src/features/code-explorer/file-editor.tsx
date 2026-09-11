"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";

type FieldFailure = Error & { fieldErrors?: Record<string, string> };

export function FileEditor({ owner, repo, branch, path, sha, content, onClose }: {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  sha: string;
  content: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState(content);
  const [message, setMessage] = useState(`Update ${path}`);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
  async function save() {
    setPending(true);
    setError("");
    setFieldErrors({});
    try {
      await apiRequest(endpoint, { method: "PUT", body: JSON.stringify({ path, content: value, message, branch, sha }) });
      toast(`${path} updated.`);
      onClose();
      router.refresh();
    } catch (unknownError) {
      const failure = unknownError as FieldFailure;
      setError(failure.message);
      setFieldErrors(failure.fieldErrors ?? {});
    } finally {
      setPending(false);
    }
  }
  return <form className="editor-shell" onSubmit={(event) => { event.preventDefault(); void save(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
    <label>Commit message<input value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={500}/>{fieldErrors.message ? <span className="field-error">{fieldErrors.message}</span> : null}</label>
    <label>File content<textarea className="editor-textarea" value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false}/>{fieldErrors.content ? <span className="field-error">{fieldErrors.content}</span> : null}</label>
    {error ? <div className="inline-error" role="alert">{error}</div> : null}
    <div className="button-row">
      <Button type="submit" variant="primary" loading={pending}><Save/> Save changes</Button>
      <Button type="button" onClick={onClose}><X/> Cancel</Button>
    </div>
  </form>;
}

export function NewFileForm({ owner, repo, branch, onClose, onCreated }: {
  owner: string;
  repo: string;
  branch: string;
  onClose: () => void;
  onCreated: (path: string) => void;
}) {
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("Add new file");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
  async function create() {
    setPending(true);
    setError("");
    setFieldErrors({});
    try {
      await apiRequest(endpoint, { method: "PUT", body: JSON.stringify({ path, content, message, branch }) });
      toast(`${path} created.`);
      onCreated(path);
      router.refresh();
    } catch (unknownError) {
      const failure = unknownError as FieldFailure;
      setError(failure.message);
      setFieldErrors(failure.fieldErrors ?? {});
    } finally {
      setPending(false);
    }
  }
  return <form className="stack-sm" onSubmit={(event) => { event.preventDefault(); void create(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
    <label>New file path<input value={path} onChange={(event) => setPath(event.target.value)} required maxLength={1024} placeholder="src/new-file.ts" aria-describedby={fieldErrors.path ? "new-file-path-error" : undefined}/>{fieldErrors.path ? <span id="new-file-path-error" className="field-error">{fieldErrors.path}</span> : null}</label>
    <label>Initial content<textarea className="editor-textarea" style={{ minHeight: 150 }} value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false}/>{fieldErrors.content ? <span className="field-error">{fieldErrors.content}</span> : null}</label>
    <label>Commit message<input value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={500}/>{fieldErrors.message ? <span className="field-error">{fieldErrors.message}</span> : null}</label>
    {error ? <div className="inline-error" role="alert">{error}</div> : null}
    <div className="button-row">
      <Button type="submit" size="sm" variant="primary" loading={pending}><Save/> Create file</Button>
      <Button type="button" size="sm" onClick={onClose}><X/> Cancel</Button>
    </div>
  </form>;
}
