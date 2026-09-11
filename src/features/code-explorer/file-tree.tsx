"use client";
import { useMemo, useState } from "react";
import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";
import type { TreeEntry } from "@/shared/contracts/content";

type TreeNode = {
  name: string;
  path: string;
  type: "blob" | "tree";
  size: number | null;
  children: TreeNode[];
};

export function FileTree({ entries, activePath, onSelect }: { entries: TreeEntry[]; activePath: string | null; onSelect: (path: string) => void }) {
  const tree = useMemo(() => buildTree(entries), [entries]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const ancestors = useMemo(() => new Set(ancestorPaths(activePath)), [activePath]);
  function isOpen(path: string) {
    return overrides[path] ?? ancestors.has(path);
  }
  function toggle(path: string) {
    setOverrides((current) => ({ ...current, [path]: !(current[path] ?? ancestors.has(path)) }));
  }
  if (entries.length === 0) return <div className="tree"><p className="muted text-xs">This branch has no files.</p></div>;
  return <div className="tree" aria-label="Repository files">
    {tree.map((node) => (
      <TreeItem key={node.path} node={node} depth={0} activePath={activePath} isOpen={isOpen} onToggle={toggle} onSelect={onSelect}/>
    ))}
  </div>;
}

function TreeItem({ node, depth, activePath, isOpen, onToggle, onSelect }: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  isOpen: (path: string) => boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  if (node.type === "tree") {
    const open = isOpen(node.path);
    return <>
      <button type="button" className="tree-row" style={{ paddingLeft: 8 + depth * 14 }} aria-expanded={open} onClick={() => onToggle(node.path)}>
        <ChevronRight className={`tree-caret${open ? " tree-caret-open" : ""}`} aria-hidden="true"/>
        {open ? <FolderOpen className="tree-icon-dir" aria-hidden="true"/> : <Folder className="tree-icon-dir" aria-hidden="true"/>}
        <span className="tree-name">{node.name}</span>
      </button>
      {open ? node.children.map((child) => (
        <TreeItem key={child.path} node={child} depth={depth + 1} activePath={activePath} isOpen={isOpen} onToggle={onToggle} onSelect={onSelect}/>
      )) : null}
    </>;
  }
  const active = activePath === node.path;
  return <button type="button" className={`tree-row${active ? " tree-row-active" : ""}`} style={{ paddingLeft: 8 + depth * 14 + 19 }} aria-current={active ? "true" : undefined} onClick={() => onSelect(node.path)}>
    <FileCode2 aria-hidden="true"/>
    <span className="tree-name">{node.name}</span>
  </button>;
}

export function buildTree(entries: TreeEntry[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  function ensure(path: string, name: string, type: "blob" | "tree", size: number | null): TreeNode {
    const existing = nodes.get(path);
    if (existing) return existing;
    const node: TreeNode = { name, path, type, size, children: [] };
    nodes.set(path, node);
    const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (!parentPath) roots.push(node);
    else ensure(parentPath, basename(parentPath), "tree", null).children.push(node);
    return node;
  }
  for (const entry of entries) {
    if (entry.type === "commit") continue;
    ensure(entry.path, entry.name, entry.type, entry.type === "tree" ? null : entry.size);
  }
  sortNodes(roots);
  return roots;
}

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((left, right) => left.type === right.type ? left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) : left.type === "tree" ? -1 : 1);
  for (const node of nodes) sortNodes(node.children);
}

export function ancestorPaths(path: string | null): string[] {
  if (!path) return [];
  const segments = path.split("/");
  const directories: string[] = [];
  let current = "";
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!segment) continue;
    current = current ? `${current}/${segment}` : segment;
    directories.push(current);
  }
  return directories;
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}
