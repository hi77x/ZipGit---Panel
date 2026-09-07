import { Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { RepositoryCard } from "@/features/repository-list/repository-card";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";

export default async function RepositoriesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const query = await searchParams;
  const pageNumber = Math.max(1, Number(query.page) || 1);
  let data: Awaited<ReturnType<RepositoryService["list"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new RepositoryService(new GitHubClient(accessToken, crypto.randomUUID())).list({ affiliation: "owner,collaborator,organization_member", sort: "updated", direction: "desc", page: pageNumber, perPage: 30 });
  } catch { return <div className="page"><ErrorState message="Repositories could not be loaded from GitHub."/></div>; }
  const needle = query.q?.trim().toLowerCase() ?? "";
  const repositories = needle ? data.repositories.filter((repo) => `${repo.fullName} ${repo.description ?? ""}`.toLowerCase().includes(needle)) : data.repositories;
  return <div className="page"><header className="page-header"><div><span className="eyebrow">GitHub library</span><h1>Repositories</h1><p>Private and public repositories available to the connected GitHub account.</p></div><ButtonLink href="/import" variant="primary">Import ZIP</ButtonLink></header>
    <form className="search-form"><label htmlFor="repo-search" className="sr-only">Search loaded repositories</label><Search aria-hidden="true"/><input id="repo-search" name="q" defaultValue={query.q} placeholder="Search this page by name or description"/><button className="button button-secondary" type="submit">Search</button></form>
    {repositories.length ? <div className="grid">{repositories.map((repo) => <RepositoryCard key={repo.id} repository={repo}/>)}</div> : <EmptyState title="No matching repositories" message={needle ? "Try a different search on this loaded page." : "No GitHub repositories are available yet."}/>} 
    <nav className="pagination" aria-label="Repository pages">{pageNumber > 1 ? <ButtonLink href={`/repositories?page=${pageNumber - 1}${needle ? `&q=${encodeURIComponent(needle)}` : ""}`}>Previous</ButtonLink> : <span/>}{data.hasNext ? <ButtonLink href={`/repositories?page=${pageNumber + 1}${needle ? `&q=${encodeURIComponent(needle)}` : ""}`}>Next</ButtonLink> : null}</nav>
  </div>;
}
