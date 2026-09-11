import { Activity, BookMarked, FolderGit2, GitFork, LockKeyhole, Radar, Search, ShieldCheck, Star, Upload, Users } from "lucide-react";
import { auth } from "@/auth";
import { ButtonLink } from "@/components/ui/button";
import { Card, Metric, Panel, PanelHead } from "@/components/ui/card";
import { EmptyState, ErrorState, PermissionState } from "@/components/feedback/states";
import { Donut } from "@/components/charts";
import { RepositoryCard } from "@/features/repository-list/repository-card";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";
import { AppError } from "@/shared/contracts/api-error";
import { languageColor } from "@/lib/language";
import { formatNumber } from "@/lib/format";
import type { RepositoryDto } from "@/shared/contracts/repository";

export default async function DashboardPage() {
  const session = await auth();
  let repositories: RepositoryDto[] = [];
  let loadError: unknown;
  try {
    const { accessToken } = await requireGitHubSession();
    const data = await new RepositoryService(new GitHubClient(accessToken, crypto.randomUUID())).list({ affiliation: "owner,collaborator,organization_member", sort: "pushed", direction: "desc", page: 1, perPage: 100 });
    repositories = data.repositories;
  } catch (error) {
    loadError = error;
  }
  if (loadError) {
    if (loadError instanceof AppError && (loadError.code === "UNAUTHENTICATED" || loadError.code === "AUTH_RECONNECT_REQUIRED")) return <div className="page"><PermissionState message={loadError.message}/></div>;
    return <div className="page"><ErrorState message="GitHub repositories could not be loaded. Your existing data has not been changed."/></div>;
  }

  const privateCount = repositories.filter((repo) => repo.visibility === "private").length;
  const totalStars = repositories.reduce((total, repo) => total + repo.stars, 0);
  const totalForks = repositories.reduce((total, repo) => total + repo.forks, 0);
  const totalIssues = repositories.reduce((total, repo) => total + repo.openIssues, 0);
  const languages = languageSlices(repositories);
  const recent = repositories.slice(0, 6);

  return <div className="page">
    <header className="page-header">
      <div><span className="eyebrow"><Activity/> Mission control</span><h1>Welcome back, {session?.user.login}</h1><p>Every repository you can reach, with the tools GitHub does not give you: deep audits, review-grade diffs, and file-level writes.</p></div>
      <div className="row-actions"><ButtonLink href="/search"><Search/> Search</ButtonLink><ButtonLink href="/import" variant="primary"><Upload/> Import ZIP</ButtonLink></div>
    </header>

    <div className="metric-grid">
      <Metric label="Repositories" value={formatNumber(repositories.length)} icon={<FolderGit2/>} hint={`${privateCount} private · ${repositories.length - privateCount} public`}/>
      <Metric label="Stars received" value={formatNumber(totalStars)} icon={<Star/>} hint="across the loaded selection"/>
      <Metric label="Forks" value={formatNumber(totalForks)} icon={<GitFork/>} hint="community copies"/>
      <Metric label="Open issues" value={formatNumber(totalIssues)} icon={<BookMarked/>} hint="tracked on GitHub"/>
    </div>

    <div className="insights-grid" style={{ marginTop: 18 }}>
      <Panel>
        <PanelHead title="Language mix" icon={<Radar/>} actions={<span className="muted text-xs">by repository count</span>}/>
        <div className="panel-body">
          {languages.length ? <Donut slices={languages} center={<><b style={{ fontSize: "1rem" }}>{languages[0]?.name}</b><span className="muted text-xs">{languages[0]?.percent}%</span></>}/> : <p className="muted">No language metadata yet.</p>}
        </div>
      </Panel>
      <Panel>
        <PanelHead title="Quick tools" icon={<ShieldCheck/>}/>
        <div className="panel-body stack-sm">
          <ButtonLink href="/repositories" variant="secondary"><FolderGit2/> Browse all repositories</ButtonLink>
          <ButtonLink href="/starred"><Star/> Starred repositories</ButtonLink>
          <ButtonLink href="/search"><Search/> Search code and issues</ButtonLink>
          <ButtonLink href="/notifications"><Activity/> Review queue</ButtonLink>
          <ButtonLink href="/settings"><Users/> Account and API budget</ButtonLink>
        </div>
      </Panel>
    </div>

    <section className="section-heading"><div><h2>Most recently pushed</h2><p>Ordered by the last push across owner, collaborator, and organization repositories.</p></div><ButtonLink href="/repositories">View all</ButtonLink></section>
    {recent.length ? <div className="grid">{recent.map((repo) => <RepositoryCard key={repo.id} repository={repo}/>)}</div> : <EmptyState title="No repositories yet" message="Import a ZIP to create your first repository, or grant access to existing ones." action={<ButtonLink href="/import" variant="primary">Import ZIP</ButtonLink>}/>}

    <div className="grid-2" style={{ marginTop: 16 }}>
      <Card>
        <span className="card-label">How RepoDeck works</span>
        <p className="muted text-sm" style={{ margin: "12px 0 0" }}>RepoDeck is a control plane, not a mirror. It talks to the GitHub API from this server, keeps the OAuth token inside the encrypted session cookie, and never stores your source code in a local database.</p>
      </Card>
      <Card>
        <span className="card-label">Access summary</span>
        <div className="cluster" style={{ marginTop: 12 }}>
          <span className="tag">{privateCount ? <LockKeyhole/> : <ShieldCheck/>}{privateCount} private</span>
          <span className="tag"><FolderGit2/>{repositories.length - privateCount} public</span>
          <span className="tag"><Star/>{formatNumber(totalStars)} stars</span>
        </div>
      </Card>
    </div>
  </div>;
}

function languageSlices(repositories: RepositoryDto[]) {
  const counts = new Map<string, number>();
  for (const repo of repositories) if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  if (!total) return [];
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, percent: Math.round((count / total) * 100), bytes: count, color: languageColor(name) }));
}
