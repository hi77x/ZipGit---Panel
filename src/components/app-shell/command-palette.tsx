"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Command, Github, House, Plus, Search } from "lucide-react";
import { rankByFuzzy } from "@/lib/fuzzy";
import { readThemePreference, saveThemePreference } from "@/lib/theme";

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: "page" | "repo" | "action";
  avatar?: string;
  run: () => void;
};

export function CommandPalette({ userLogin }: { userLogin: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [repos, setRepos] = useState<Array<{ fullName: string; owner: string; name: string; avatarUrl: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      }
      if (event.key === "Escape") setOpen(false);
    }
    function onOpen() { openPalette(); }
    document.addEventListener("keydown", onKey);
    window.addEventListener("repodeck:command", onOpen);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("repodeck:command", onOpen); };
  }, [open, openPalette]);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    void (async () => {
      try {
        const response = await fetch("/api/github/repositories?perPage=100&sort=updated", { cache: "no-store" });
        const payload = await response.json() as { ok: boolean; data?: { repositories: typeof repos } };
        if (payload.ok && payload.data) setRepos(payload.data.repositories);
      } catch { /* palette still works without repos */ }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => { setOpen(false); router.push(href); };
    const base: PaletteItem[] = [
      { id: "nav-dashboard", label: "Dashboard", group: "Navigate", icon: "page", run: go("/dashboard") },
      { id: "nav-repos", label: "Repositories", group: "Navigate", icon: "page", run: go("/repositories") },
      { id: "nav-starred", label: "Starred repositories", group: "Navigate", icon: "page", run: go("/starred") },
      { id: "nav-search", label: "Global search", group: "Navigate", icon: "page", run: go("/search") },
      { id: "nav-notifications", label: "Notifications", group: "Navigate", icon: "page", run: go("/notifications") },
      { id: "nav-settings", label: "Settings", group: "Navigate", icon: "page", run: go("/settings") },
      { id: "action-import", label: "Import ZIP archive", group: "Actions", icon: "action", run: go("/import") },
      { id: "action-new-issue", label: "Open global search for issues", hint: "GitHub search", group: "Actions", icon: "action", run: go("/search?tab=issues") },
      { id: "action-theme", label: "Toggle dark / light theme", group: "Actions", icon: "action", hint: "Theme", run: () => { saveThemePreference(readThemePreference() === "dark" ? "light" : "dark"); setOpen(false); } },
      { id: "action-profile", label: `GitHub profile: ${userLogin}`, group: "Actions", icon: "action", run: () => { setOpen(false); window.open(`https://github.com/${userLogin}`, "_blank", "noopener"); } }
    ];
    const repoItems: PaletteItem[] = repos.map((repo) => ({
      id: `repo-${repo.fullName}`,
      label: repo.name,
      hint: repo.owner,
      group: "Repositories",
      icon: "repo",
      avatar: repo.avatarUrl,
      run: () => { setOpen(false); router.push(`/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`); }
    }));
    const all = [...base, ...repoItems];
    if (!query.trim()) return all.slice(0, 40);
    return rankByFuzzy(all, query, (item) => `${item.label} ${item.hint ?? ""} ${item.group}`).map((entry) => entry.item).slice(0, 30);
  }, [query, repos, router, userLogin]);

  if (!open) return null;

  const grouped: Array<[string, PaletteItem[]]> = [];
  for (const item of items) {
    const existing = grouped.find(([group]) => group === item.group);
    if (existing) existing[1].push(item);
    else grouped.push([item.group, [item]]);
  }
  const flat = grouped.flatMap(([, groupItems]) => groupItems);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(flat.length - 1, value + 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
    if (event.key === "Enter") { event.preventDefault(); flat[active]?.run(); }
  }

  const iconFor = (item: PaletteItem) => item.icon === "repo" ? (item.avatar ? <Image src={item.avatar} alt="" width={16} height={16} className="avatar-sm"/> : <Github/>) : item.icon === "action" ? <Plus/> : <House/>;

  return <div className="palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="palette-input"><Command aria-hidden="true"/><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} placeholder="Search repositories, pages, and actions…" aria-label="Command palette search"/><span className="kbd">esc</span></div>
      <div className="palette-list">
        {grouped.map(([group, groupItems]) => <div key={group}>
          <div className="palette-group">{group}</div>
          {groupItems.map((item) => {
            const index = flat.indexOf(item);
            return <button type="button" key={item.id} className={`palette-item ${index === active ? "palette-item-active" : ""}`} onMouseEnter={() => setActive(index)} onClick={item.run}>
              {iconFor(item)}
              <span className="truncate">{item.label}</span>
              {item.hint ? <span className="palette-shortcut">{item.hint}</span> : null}
            </button>;
          })}
        </div>)}
        {!flat.length ? <div className="palette-empty">No results for “{query}”. Try a repository name.</div> : null}
      </div>
    </div>
  </div>;
}

export function CommandTrigger() {
  return <button type="button" className="command-trigger" onClick={() => window.dispatchEvent(new Event("repodeck:command"))} aria-label="Open command palette">
    <Search aria-hidden="true"/><span>Search or jump to…</span><span className="kbd">⌘K</span>
  </button>;
}
