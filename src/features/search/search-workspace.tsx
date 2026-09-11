"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookMarked, Code2, GitPullRequest, Search, Terminal } from "lucide-react";
import { Card } from "@/components/ui/card";

const examples = [
  { label: "Popular TypeScript repositories", query: "language:typescript stars:>1000", tab: "repositories", icon: BookMarked },
  { label: "React hooks in code", query: "useEffect language:typescript", tab: "code", icon: Code2 },
  { label: "Open bug issues", query: "is:issue is:open label:bug", tab: "issues", icon: GitPullRequest },
  { label: "README installation steps", query: "filename:README.md installation", tab: "code", icon: Terminal }
] as const;

export function SearchWorkspace() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return <div className="feature-stack">
    <form className="search-form" onSubmit={(event) => void submit(event)}>
      <Search aria-hidden="true"/>
      <label className="sr-only" htmlFor="global-search">Search GitHub</label>
      <input id="global-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repositories, code, and issues" autoComplete="off"/>
      <button className="button button-primary" type="submit">Search</button>
    </form>
    <Card>
      <span className="card-label">Try a query</span>
      <div className="cluster" style={{ marginTop: 12 }}>
        {examples.map(({ label, query: example, tab, icon: Icon }) => <Link className="tag" key={label} href={`/search?q=${encodeURIComponent(example)}&tab=${tab}`}><Icon/>{label}</Link>)}
      </div>
    </Card>
    <Card>
      <span className="card-label">Search syntax</span>
      <p className="muted text-sm" style={{ margin: "12px 0 0" }}>GitHub search supports qualifiers such as <code>repo:</code>, <code>org:</code>, <code>language:</code>, <code>filename:</code>, <code>is:issue</code>, and <code>stars:&gt;100</code>. Results are scoped to what the connected GitHub account can access.</p>
    </Card>
  </div>;
}
