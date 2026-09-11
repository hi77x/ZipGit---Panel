"use client";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { CodeViewer } from "@/components/code/code-viewer";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { useToast } from "@/components/feedback/toast-provider";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/features/api-client";
import { formatBytes } from "@/lib/format";
import type { BranchDto, FileContentDto, TreeEntry } from "@/shared/contracts/content";
import { BranchMenu } from "./branch-menu";
import { FileEditor, NewFileForm } from "./file-editor";
import { FileTree } from "./file-tree";

export type ExplorerProps = {
  owner: string;
  repo: string;
  initialRef: string;
  defaultBranch: string;
  initialBranches: BranchDto[];
  initialEntries: TreeEntry[] | null;
  initialTreeError: string | null;
  initialPath: string | null;
  initialFile: FileContentDto | null;
  initialFileError: string | null;
};

export function Explorer({ owner, repo, initialRef, defaultBranch, initialBranches, initialEntries, initialTreeError, initialPath, initialFile, initialFileError }: ExplorerProps) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const endpoint = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
  const codeBase = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/code`;

  useEffect(() => {
    setEditing(false);
    setCreating(false);
  }, [initialPath, initialRef]);

  function codeUrl(path: string | null, ref: string): string {
    const suffix = path ? `/${path.split("/").map((segment) => encodeURIComponent(segment)).join("/")}` : "";
    return `${codeBase}${suffix}?ref=${encodeURIComponent(ref)}`;
  }

  function selectFile(path: string) {
    router.push(codeUrl(path, initialRef));
  }

  function switchBranch(ref: string) {
    router.push(codeUrl(initialPath, ref));
  }

  function fileCreated(path: string) {
    setCreating(false);
    router.push(codeUrl(path, initialRef));
  }

  async function deleteFile() {
    if (!initialPath || !initialFile || !window.confirm(`Delete ${initialPath} from ${initialRef}?`)) return;
    setDeleting(true);
    try {
      await apiRequest(endpoint, { method: "DELETE", body: JSON.stringify({ path: initialPath, message: `Delete ${initialPath}`, branch: initialRef, sha: initialFile.sha }) });
      toast(`${initialPath} deleted.`);
      router.push(codeUrl(null, initialRef));
      router.refresh();
    } catch (unknownError) {
      toast(unknownError instanceof Error ? unknownError.message : "The file could not be deleted.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function copyRawLink() {
    if (!initialFile) return;
    try {
      await navigator.clipboard.writeText(initialFile.downloadUrl ?? initialFile.htmlUrl);
      toast("Raw link copied.");
    } catch {
      toast("Clipboard access is unavailable.", "error");
    }
  }

  function header(file: FileContentDto, allowEdit: boolean) {
    return <header className="code-header">
      <Breadcrumb path={file.path}/>
      <span className="code-meta">{formatBytes(file.size)}{file.truncated ? " · preview limited" : ""}</span>
      <div className="row-actions">
        <Button size="sm" type="button" onClick={() => void copyRawLink()}><Copy/> Copy raw link</Button>
        {allowEdit && file.decoded ? <Button size="sm" type="button" variant="primary" onClick={() => setEditing(true)}><Pencil/> Edit</Button> : null}
        <Button size="sm" type="button" variant="danger" loading={deleting} onClick={() => void deleteFile()}><Trash2/> Delete</Button>
      </div>
    </header>;
  }

  return <div className="explorer">
    <aside className="explorer-sidebar">
      <div className="explorer-sidebar-head">
        <BranchMenu owner={owner} repo={repo} current={initialRef} defaultBranch={defaultBranch} branches={initialBranches} onSelect={switchBranch}/>
        <Button size="sm" type="button" onClick={() => setCreating((value) => !value)} aria-expanded={creating}><FilePlus2/> New file</Button>
        {creating ? <NewFileForm owner={owner} repo={repo} branch={initialRef} onClose={() => setCreating(false)} onCreated={fileCreated}/> : null}
      </div>
      {initialEntries ? <FileTree entries={initialEntries} activePath={initialPath} onSelect={selectFile}/> : initialTreeError ? <div className="tree"><ErrorState message={initialTreeError}/></div> : null}
    </aside>
    <section className="explorer-main">
      {initialFile ? header(initialFile, !editing) : null}
      {editing && initialFile ? <FileEditor owner={owner} repo={repo} branch={initialRef} path={initialFile.path} sha={initialFile.sha} content={initialFile.content} onClose={() => setEditing(false)}/> : initialFile ? (
        initialFile.decoded ? <CodeViewer code={initialFile.content} path={initialFile.path} maxHeight={720}/> : <div className="file-preview"><EmptyState title="Preview unavailable" message="This file is binary or larger than 1 MiB. Use the raw link to open it on GitHub."/></div>
      ) : initialPath && initialFileError ? <ErrorState message={initialFileError}/> : <EmptyState title="No file selected" message="Select a file to view its contents"/>}
    </section>
  </div>;
}

function Breadcrumb({ path }: { path: string }) {
  const segments = path.split("/");
  return <nav className="code-path" aria-label="Current file path">
    {segments.map((segment, index) => index === segments.length - 1
      ? <strong key={`${index}:${segment}`}>{segment}</strong>
      : <Fragment key={`${index}:${segment}`}><span>{segment}</span><span aria-hidden="true">/</span></Fragment>)}
  </nav>;
}
