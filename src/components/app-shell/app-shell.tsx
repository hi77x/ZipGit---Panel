"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Archive, Github, House, Menu, Upload, X } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: House },
  { href: "/repositories", label: "Repositories", icon: Github },
  { href: "/import", label: "Import ZIP", icon: Upload }
];

export function AppShell({ children, user, logout }: { children: React.ReactNode; user: { login: string; avatarUrl?: string | null }; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
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
  return <div className="app-shell">
    <button ref={menuRef} className="mobile-menu button button-ghost" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu/></button>
    {open ? <button className="drawer-backdrop" aria-label="Dismiss navigation" onClick={() => setOpen(false)}/> : null}
    <aside ref={asideRef} className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Primary navigation" aria-modal={open || undefined} role={open ? "dialog" : undefined}>
      <div className="brand"><span className="brand-mark"><Archive/></span><span><strong>ZipToGit</strong><small>Pro · v4</small></span></div>
      <button ref={closeRef} className="drawer-close button button-ghost" onClick={() => setOpen(false)} aria-label="Close navigation"><X/></button>
      <nav>{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""} onClick={() => setOpen(false)}><Icon aria-hidden="true"/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-footer"><div className="user-chip">{user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={38} height={38}/> : <Github/>}<span><small>Signed in as</small><strong>{user.login}</strong></span></div><form action={logout}><button className="button button-ghost" type="submit">Sign out</button></form></div>
    </aside>
    <main className="app-main">{children}</main>
  </div>;
}
