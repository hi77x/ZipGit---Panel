import { Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { RepositoryCard } from "@/features/repository-list/repository-card";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";

export default async function StarredPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  let data: Awaited<ReturnType<RepositoryService["listStarred"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new RepositoryService(new GitHubClient(accessToken, crypto.randomUUID())).listStarred(page, 30);
  } catch {
    return <div className="page"><ErrorState message="Starred repositories could not be loaded from GitHub."/></div>;
  }
  return <div className="page">
    <header className="page-header">
      <div><span className="eyebrow"><Star/> GitHub library</span><h1>Starred repositories</h1><p>Repositories you have starred, ordered by the most recent star activity.</p></div>
      <ButtonLink href="/repositories">All repositories</ButtonLink>
    </header>
    {data.repositories.length ? <div className="grid">{data.repositories.map((repository) => <RepositoryCard key={repository.id} repository={repository}/>)}</div> : <EmptyState title="No starred repositories" message="Star repositories on GitHub and they will appear here." action={<ButtonLink href="/repositories" variant="primary">Browse repositories</ButtonLink>}/>}
    <nav className="pagination" aria-label="Starred repository pages">
      {page > 1 ? <ButtonLink href={`/starred?page=${page - 1}`}>Previous</ButtonLink> : <span/>}
      {data.hasNext ? <ButtonLink href={`/starred?page=${page + 1}`}>Next</ButtonLink> : null}
    </nav>
  </div>;
}
