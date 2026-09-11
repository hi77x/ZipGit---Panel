import Link from "next/link";
import { Archive, BookOpen, ExternalLink, GitBranch, GitPullRequest, History, Radar, Rocket, ShieldAlert, Tag, Terminal } from "lucide-react";
import { ErrorState } from "@/components/feedback/states";
import { Badge } from "@/components/ui/card";
import { StarButton } from "@/features/repository-list/star-button";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";

export default async function RepositoryLayout({ children, params }: { children: React.ReactNode; params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  let repository: Awaited<ReturnType<RepositoryService["detail"]>> | null = null;
  let accessToken: string | null = null;
  try {
    const session = await requireGitHubSession();
    accessToken = session.accessToken;
    repository = await new RepositoryService(new GitHubClient(accessToken, crypto.randomUUID())).detail(owner, repo);
  } catch { return <div className="page"><ErrorState title="Repository unavailable" message="This repository was deleted, renamed, or is not accessible with the current GitHub permission."/></div>; }
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const tabs = [
    { href: base, label: "Overview", icon: BookOpen },
    { href: `${base}/code`, label: "Code", icon: Terminal },
    { href: `${base}/commits`, label: "Commits", icon: History },
    { href: `${base}/branches`, label: "Branches", icon: GitBranch },
    { href: `${base}/issues`, label: "Issues", icon: ShieldAlert },
    { href: `${base}/pulls`, label: "Pull requests", icon: GitPullRequest },
    { href: `${base}/releases`, label: "Releases", icon: Tag },
    { href: `${base}/radar`, label: "Radar", icon: Radar },
    { href: `${base}/actions`, label: "Actions", icon: Rocket },
    { href: `${base}/pages`, label: "Pages", icon: Archive }
  ];
  return <div className="page repo-page">
    <header className="repo-header">
      <div>
        <span className="repo-owner">{repository.owner} /</span><h1>{repository.name}</h1>
        <Badge tone={repository.visibility === "private" ? "warning" : "neutral"}>{repository.visibility}</Badge>
        {repository.archived ? <Badge tone="danger">archived</Badge> : null}
        {repository.license ? <Badge>{repository.license}</Badge> : null}
      </div>
      <div className="row-actions">
        <StarButton owner={owner} repo={repo} initialStars={repository.stars}/>
        <a className="button" href={repository.url} target="_blank" rel="noopener noreferrer">GitHub <ExternalLink/></a>
      </div>
    </header>
    {repository.description ? <p className="muted" style={{ marginTop: 12, maxWidth: 780 }}>{repository.description}</p> : null}
    <nav className="repo-tabs" aria-label="Repository sections">{tabs.map(({ href, label, icon: Icon }) => <Link key={href} href={href}><Icon/>{label}</Link>)}</nav>
    {children}
  </div>;
}
