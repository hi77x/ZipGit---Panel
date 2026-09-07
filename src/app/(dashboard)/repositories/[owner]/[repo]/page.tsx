import { GitFork, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/states";
import { ReadmeViewer } from "@/features/readme-viewer/readme-viewer";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";
import { ReadmeService } from "@/server/services/readme-service";

export default async function RepositoryOverview({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  let repository: Awaited<ReturnType<RepositoryService["detail"]>> | null = null;
  let readme: Awaited<ReturnType<ReadmeService["get"]>> | null = null;
  let pageError = false, readmeError = false;
  try {
    const { accessToken } = await requireGitHubSession();
    const github = new GitHubClient(accessToken, crypto.randomUUID());
    repository = await new RepositoryService(github).detail(owner, repo);
    try { readme = await new ReadmeService(github).get(owner, repo, repository.defaultBranch); } catch { readmeError = true; }
  } catch { pageError = true; }
  if (pageError || !repository) return <ErrorState message="Repository details could not be loaded."/>;
  return <div className="repo-overview"><div className="overview-grid"><Card><span className="card-label">Description</span><p>{repository.description || "No description provided."}</p><dl className="stats"><div><dt>Language</dt><dd>{repository.language ?? "—"}</dd></div><div><dt><Star/> Stars</dt><dd>{repository.stars}</dd></div><div><dt><GitFork/> Forks</dt><dd>{repository.forks}</dd></div><div><dt>Default branch</dt><dd><code>{repository.defaultBranch}</code></dd></div></dl></Card><Card><span className="card-label">Last update</span><p><time dateTime={repository.updatedAt}>{new Date(repository.updatedAt).toLocaleString()}</time></p><span className="card-label">Repository URL</span><a className="break-anywhere" href={repository.url} target="_blank" rel="noopener noreferrer">{repository.url}</a></Card></div>
    {readmeError ? <ErrorState title="README could not be loaded" message="Repository details remain available. Retry this page when GitHub is reachable."/> : readme ? <ReadmeViewer data={readme}/> : null}</div>;
}
