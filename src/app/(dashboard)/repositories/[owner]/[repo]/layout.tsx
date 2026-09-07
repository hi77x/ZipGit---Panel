import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ErrorState } from "@/components/feedback/states";
import { Badge } from "@/components/ui/card";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";

export default async function RepositoryLayout({ children, params }: { children: React.ReactNode; params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  let repository: Awaited<ReturnType<RepositoryService["detail"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    repository = await new RepositoryService(new GitHubClient(accessToken, crypto.randomUUID())).detail(owner, repo);
  } catch { return <div className="page"><ErrorState title="Repository unavailable" message="This repository was deleted, renamed, or is not accessible with the current GitHub permission."/></div>; }
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return <div className="page repo-page"><header className="repo-header"><div><span className="repo-owner">{repository.owner} /</span><h1>{repository.name}</h1><Badge tone={repository.visibility === "private" ? "warning" : "neutral"}>{repository.visibility}</Badge></div><a className="button button-secondary" href={repository.url} target="_blank" rel="noopener noreferrer">Open on GitHub <ExternalLink/></a></header>
    <nav className="repo-tabs" aria-label="Repository sections"><Link href={base}>Overview</Link><Link href={`${base}/activity`}>Activity</Link><Link href={`${base}/pages`}>Pages</Link><Link href={`${base}/actions`}>Actions</Link></nav>
    {children}
  </div>;
}
