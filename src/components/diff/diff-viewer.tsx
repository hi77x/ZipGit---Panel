"use client";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FileCode2, FilePlus2, FileX2, Filter, FolderGit2, ListFilter } from "lucide-react";
import type { FileDiffDto } from "@/shared/contracts/content";
import { parsePatch, type DiffHunk } from "@/lib/diff";
import { languageFromPath } from "@/lib/language";
import { tokenize } from "@/lib/syntax";
import { formatNumber } from "@/lib/format";

type ViewedMap = Record<string, boolean>;

const viewedListeners = new Set<() => void>();

function subscribeViewedStore(listener: () => void): () => void {
  viewedListeners.add(listener);
  window.addEventListener("storage", listener);
  window.addEventListener("repodeck:viewed", listener);
  return () => {
    viewedListeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener("repodeck:viewed", listener);
  };
}

function readViewedStore(storageKey: string): string {
  try { return window.localStorage.getItem(`repodeck-viewed:${storageKey}`) ?? "{}"; } catch { return "{}"; }
}

function writeViewedStore(storageKey: string, value: ViewedMap): void {
  try { window.localStorage.setItem(`repodeck-viewed:${storageKey}`, JSON.stringify(value)); } catch { /* storage full */ }
  for (const listener of viewedListeners) listener();
}

export function DiffViewer({ files, storageKey, showFilter = true, collapsible = true, defaultOpen = true, collapseThreshold = 700, emptyMessage = "No file changes in this range." }: {
  files: FileDiffDto[];
  storageKey?: string;
  showFilter?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  collapseThreshold?: number;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [expandedLarge, setExpandedLarge] = useState<Record<string, boolean>>({});

  const subscribe = useCallback((listener: () => void) => subscribeViewedStore(listener), []);
  const getSnapshot = useCallback(() => (storageKey ? readViewedStore(storageKey) : "{}"), [storageKey]);
  const rawViewed = useSyncExternalStore(subscribe, getSnapshot, () => "{}");
  const viewed = useMemo<ViewedMap>(() => {
    try { return JSON.parse(rawViewed) as ViewedMap; } catch { return {}; }
  }, [rawViewed]);

  function toggleViewed(filename: string) {
    if (!storageKey) return;
    writeViewedStore(storageKey, { ...viewed, [filename]: !viewed[filename] });
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? files.filter((file) => file.filename.toLowerCase().includes(needle) || (file.previousFilename ?? "").toLowerCase().includes(needle)) : files;
  }, [files, query]);

  const totals = useMemo(() => files.reduce((total, file) => ({ additions: total.additions + file.additions, deletions: total.deletions + file.deletions }), { additions: 0, deletions: 0 }), [files]);
  const viewedCount = files.filter((file) => viewed[file.filename]).length;

  if (!files.length) return <div className="empty"><FileCode2/><h3>Nothing to compare</h3><p>{emptyMessage}</p></div>;

  return <div className="diff">
    <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
      <div className="diff-stats" style={{ fontSize: ".82rem" }}>
        <span className="muted">{files.length} file{files.length === 1 ? "" : "s"} changed</span>
        <span className="diff-add-count">+{formatNumber(totals.additions)}</span>
        <span className="diff-del-count">−{formatNumber(totals.deletions)}</span>
        {storageKey ? <span className="muted">· {viewedCount}/{files.length} reviewed</span> : null}
      </div>
      <div className="row-actions">
        {showFilter ? <div className="search-form" style={{ margin: 0, padding: "3px 8px", minWidth: 200 }}><Filter aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by path" aria-label="Filter files by path"/></div> : null}
        {collapsible ? <button type="button" className="button button-ghost button-sm" onClick={() => setOpen(Object.fromEntries(filtered.map((file) => [file.filename, true])))}><ChevronDown/>Expand all</button> : null}
        {collapsible ? <button type="button" className="button button-ghost button-sm" onClick={() => setOpen(Object.fromEntries(filtered.map((file) => [file.filename, false])))}><ChevronRight/>Collapse all</button> : null}
      </div>
    </div>
    {filtered.map((file) => (
      <DiffFile
        file={file}
        key={file.filename}
        collapsible={collapsible}
        open={open[file.filename] ?? defaultOpen}
        expanded={expandedLarge[file.filename] ?? false}
        viewed={Boolean(viewed[file.filename])}
        showViewed={Boolean(storageKey)}
        threshold={collapseThreshold}
        onToggleOpen={() => setOpen((current) => ({ ...current, [file.filename]: !(current[file.filename] ?? defaultOpen) }))}
        onToggleViewed={() => toggleViewed(file.filename)}
        onExpand={() => setExpandedLarge((current) => ({ ...current, [file.filename]: true }))}
      />
    ))}
    {!filtered.length ? <div className="empty"><ListFilter/><h3>No files match</h3><p>Try a different path fragment.</p></div> : null}
  </div>;
}

function DiffFile({ file, open, expanded, viewed, showViewed, collapsible, threshold, onToggleOpen, onToggleViewed, onExpand }: {
  file: FileDiffDto;
  open: boolean;
  expanded: boolean;
  viewed: boolean;
  showViewed: boolean;
  collapsible: boolean;
  threshold: number;
  onToggleOpen: () => void;
  onToggleViewed: () => void;
  onExpand: () => void;
}) {
  const parsed = useMemo(() => parsePatch(file.patch), [file.patch]);
  const info = languageFromPath(file.filename);
  const lineCount = parsed.hunks.reduce((total, hunk) => total + hunk.lines.length, 0);
  const large = !expanded && lineCount > threshold;
  const kind = changeKind(file.status, file.additions, file.deletions);
  return <section className="diff-file">
    <header className="diff-file-head">
      {collapsible ? <button type="button" className="button button-ghost button-icon button-sm" onClick={onToggleOpen} aria-expanded={open} aria-label={open ? "Collapse file" : "Expand file"}>{open ? <ChevronDown/> : <ChevronRight/>}</button> : null}
      <KindIcon kind={kind}/>
      <span className="diff-path" title={file.previousFilename ? `${file.previousFilename} → ${file.filename}` : file.filename}>
        {file.previousFilename ? <span className="muted">{file.previousFilename} → </span> : null}{file.filename}
      </span>
      <span className="diff-stats"><span className="diff-add-count">+{file.additions}</span><span className="diff-del-count">−{file.deletions}</span></span>
      {file.binary ? <span className="badge">binary</span> : null}
      {file.truncated && !file.binary ? <span className="badge badge-warning"><AlertTriangle/>truncated</span> : null}
      {showViewed ? <label className="diff-viewed viewed-toggle"><input type="checkbox" checked={viewed} onChange={onToggleViewed}/>Viewed</label> : null}
    </header>
    {open ? (file.binary
      ? <div className="diff-collapsed"><span>Binary file — diff preview is not available.</span></div>
      : large
        ? <div className="diff-collapsed"><span>Large diff hidden to keep the page fast ({lineCount} lines).</span><button type="button" className="button button-sm" onClick={onExpand}>Load diff</button></div>
        : parsed.hunks.length ? parsed.hunks.map((hunk, index) => <Hunk key={index} hunk={hunk} languageId={info?.id}/>) : <div className="diff-collapsed"><span>No textual changes (mode change or empty patch).</span></div>) : null}
  </section>;
}

function Hunk({ hunk, languageId }: { hunk: DiffHunk; languageId?: string }) {
  return <div className="diff-hunk">
    <div className="diff-hunk-head">{hunk.header}</div>
    {hunk.lines.map((line, index) => (
      <div className="diff-line" key={index}>
        <span className="diff-line-num">{line.oldNumber ?? ""}</span>
        <span className="diff-line-num">{line.newNumber ?? ""}</span>
        <span className={`diff-line-code ${line.type === "add" ? "add" : line.type === "del" ? "del" : ""}`}><LineTokens text={line.text} languageId={languageId}/></span>
      </div>
    ))}
  </div>;
}

function LineTokens({ text, languageId }: { text: string; languageId?: string }) {
  const tokens = useMemo(() => tokenize(text, "code", languageId)[0] ?? [], [text, languageId]);
  return <>{tokens.map((token, index) => {
    const className = { plain: "", kw: "token-kw", str: "token-str", num: "token-num", com: "token-com", fn: "token-fn", typ: "token-typ", tag: "token-tag", attr: "token-attr", punc: "token-punc", op: "token-op" }[token.type];
    return className ? <span className={className} key={index}>{token.text}</span> : <span key={index}>{token.text}</span>;
  })}</>;
}

function KindIcon({ kind }: { kind: "added" | "removed" | "modified" | "renamed" }) {
  if (kind === "added") return <FilePlus2 className="state-open" aria-label="Added"/>;
  if (kind === "removed") return <FileX2 className="state-closed" aria-label="Removed"/>;
  if (kind === "renamed") return <FolderGit2 className="muted" aria-label="Renamed"/>;
  return <FileCode2 className="muted" aria-label="Modified"/>;
}

function changeKind(status: string, additions: number, deletions: number): "added" | "removed" | "modified" | "renamed" {
  if (status === "renamed") return "renamed";
  if (status === "added") return "added";
  if (status === "removed") return "removed";
  if (additions > 0 && deletions === 0) return "added";
  if (deletions > 0 && additions === 0) return "removed";
  return "modified";
}
