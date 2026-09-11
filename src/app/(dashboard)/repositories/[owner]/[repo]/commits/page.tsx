import { GitBranch } from "lucide-react";
import { CommitList } from "@/features/commits/commit-list";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { CommitService } from "@/server/services/commit-service";
import { RepositoryService } from "@/server/services/repository-service";
import { isSafeGitHubRef } from "@/lib/url";

export default async function CommitsPage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ ref?: string; page?: string }> }) {
  const { owner, repo } = await params;
  const query = await searchParams;
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  let data: Awaited<ReturnType<CommitService["list"]>> | null = null;
  let ref = "";
  let branches: string[] = [];
  try {
    const { accessToken } = await requireGitHubSession();
    const github = new GitHubClient(accessToken, crypto.randomUUID());
    const repositories = new RepositoryService(github);
    const repository = await repositories.detail(owner, repo);
    const requestedRef = query.ref ?? "";
    ref = isSafeGitHubRef(requestedRef) ? requestedRef : repository.defaultBranch;
    branches = await repositories.branches(owner, repo, false);
    if (!branches.includes(ref)) branches = [ref, ...branches];
    data = await new CommitService(github).list(owner, repo, { ref, page, perPage: 30 });
  } catch {
    return <ErrorState message="Commit history could not be loaded from GitHub."/>;
  }
  if (!data) return <ErrorState message="Commit history could not be loaded from GitHub."/>;
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`;
  return <section>
    <header className="section-heading">
      <div>
        <h2>Commits on {ref}</h2>
        <p>Commit history for {owner}/{repo}, newest first.</p>
      </div>
      <form className="search-form" action={base} method="get">
        <GitBranch aria-hidden="true"/>
        <select name="ref" defaultValue={ref} aria-label="Switch branch or ref">
          {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
        </select>
        <Button type="submit" size="sm">Switch</Button>
      </form>
    </header>
    {data.commits.length ? <CommitList commits={data.commits} owner={owner} repo={repo}/> : <EmptyState title="No commits" message="This repository does not have any commits on the selected ref."/>}
    <nav className="pagination" aria-label="Commit pages">
      {page > 1 ? <ButtonLink href={`${base}?ref=${encodeURIComponent(ref)}&page=${page - 1}`}>Previous</ButtonLink> : <span/>}
      {data.hasNext ? <ButtonLink href={`${base}?ref=${encodeURIComponent(ref)}&page=${page + 1}`}>Next</ButtonLink> : null}
    </nav>
  </section>;
}
