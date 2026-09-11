"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, FolderGit2, Github, House, Layers, LogOut, Menu, Search, Settings, Star, Upload, User, X } from "lucide-react";
import { CommandPalette, CommandTrigger } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { RateLimitMeter } from "./rate-limit-meter";

const groups: Array<{ label: string; items: Array<{ href: string; label: string; icon: typeof House }> }> = [
  { label: "Workspace", items: [
    { href: "/dashboard", label: "Dashboard", icon: House },
    { href: "/repositories", label: "Repositories", icon: FolderGit2 },
    { href: "/starred", label: "Starred", icon: Star },
    { href: "/search", label: "Search", icon: Search },
    { href: "/notifications", label: "Notifications", icon: Bell }
  ] },
  { label: "Create", items: [
    { href: "/import", label: "Import ZIP", icon: Upload }
  ] },
  { label: "Account", items: [
    { href: "/settings", label: "Settings", icon: Settings }
  ] }
];

export function AppShell({ children, user, logout }: { children: React.ReactNode; user: { login: string; avatarUrl?: string | null }; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const menuButton = menuRef.current;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const focusable = [...(asideRef.current?.querySelectorAll<HTMLElement>('a, button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])];
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); menuButton?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => { if (!userMenuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const crumbs = buildCrumbs(pathname);

  return <div className="app-shell">
    <CommandPalette userLogin={user.login}/>
    <button ref={menuRef} className="mobile-menu button button-ghost" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu/></button>
    {open ? <button className="drawer-backdrop" aria-label="Dismiss navigation" onClick={() => setOpen(false)}/> : null}
    <aside ref={asideRef} className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Primary navigation" aria-modal={open || undefined} role={open ? "dialog" : undefined}>
      <div className="brand"><span className="brand-mark"><Layers aria-hidden="true"/></span><span><strong>RepoDeck</strong><small>Command deck</small></span></div>
      <button ref={closeRef} className="drawer-close button button-ghost" onClick={() => setOpen(false)} aria-label="Close navigation"><X/></button>
      <nav>
        {groups.map((group) => <div key={group.label}>
          <div className="sidebar-group">{group.label}</div>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className={active ? "active" : ""} onClick={() => setOpen(false)}><Icon aria-hidden="true"/><span>{label}</span></Link>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-footer">
        <div className="user-chip">{user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={34} height={34}/> : <Github/>}<span><small>Signed in as</small><strong>{user.login}</strong></span></div>
        <form action={logout}><button className="button button-ghost button-block" type="submit"><LogOut/><span>Sign out</span></button></form>
      </div>
    </aside>
    <div className="app-main">
      <header className="topbar">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => <span key={crumb.href} style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {index > 0 ? <ChevronRight aria-hidden="true"/> : null}
            {index === crumbs.length - 1 ? <strong>{crumb.label}</strong> : <Link href={crumb.href}>{crumb.label}</Link>}
          </span>)}
        </nav>
        <div className="topbar-right">
          <CommandTrigger/>
          <RateLimitMeter/>
          <NotificationBell/>
          <ThemeToggle/>
          <div className="user-menu" ref={userMenuRef}>
            <button type="button" className="user-menu-trigger" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-haspopup="menu">
              {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={24} height={24} className="avatar-sm"/> : <User aria-hidden="true"/>}
            </button>
            {menuOpen ? <div className="menu-popover" role="menu">
              <div className="menu-label">{user.login}</div>
              <a className="menu-item" href={`https://github.com/${user.login}`} target="_blank" rel="noopener noreferrer" role="menuitem"><Github/>GitHub profile</a>
              <Link className="menu-item" href="/settings" role="menuitem" onClick={() => setMenuOpen(false)}><Settings/>Settings</Link>
              <Link className="menu-item" href="/starred" role="menuitem" onClick={() => setMenuOpen(false)}><Star/>Starred</Link>
              <hr className="divider"/>
              <form action={logout}><button className="menu-item menu-item-danger" type="submit" role="menuitem"><LogOut/>Sign out</button></form>
            </div> : null}
          </div>
        </div>
      </header>
      {children}
    </div>
  </div>;
}

function buildCrumbs(pathname: string): Array<{ href: string; label: string }> {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ href: string; label: string }> = [];
  if (pathname !== "/dashboard") crumbs.push({ href: "/dashboard", label: "RepoDeck" });
  let href = "";
  for (const part of parts) {
    href += `/${part}`;
    crumbs.push({ href, label: labelFor(part, href) });
  }
  if (!crumbs.length) crumbs.push({ href: "/dashboard", label: "Dashboard" });
  return crumbs.slice(0, 5);
}

function labelFor(segment: string, href: string): string {
  const decoded = decodeURIComponent(segment);
  if (href.startsWith("/repositories")) {
    if (segment === "repositories") return "Repositories";
    return decoded.length > 22 ? `${decoded.slice(0, 20)}…` : decoded;
  }
  const names: Record<string, string> = { dashboard: "Dashboard", starred: "Starred", search: "Search", notifications: "Notifications", import: "Import ZIP", settings: "Settings" };
  return names[segment] ?? decoded.charAt(0).toUpperCase() + decoded.slice(1).replace(/[-_]/g, " ");
}
