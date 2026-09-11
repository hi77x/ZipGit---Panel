import Link from "next/link";
import { BookOpen, Calendar, CircleDot, ExternalLink, GitBranch, GitCommitHorizontal, GitFork, History, LockKeyhole, Radar, Scale, Star, Tag } from "lucide-react";
import { Card, Panel, PanelHead } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/states";
import { ReadmeViewer } from "@/features/readme-viewer/readme-viewer";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";
import { ReadmeService } from "@/server/services/readme-service";
import { formatBytes, formatDate, formatNumber, relativeTime } from "@/lib/format";
import { languageColor } from "@/lib/language";

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
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return <div className="repo-overview">
    <div className="overview-grid">
      <Card>
        <div className="spread">
          <span className="card-label">Repository</span>
          <a className="text-xs muted" href={repository.homepage ?? repository.url} target="_blank" rel="noopener noreferrer">{repository.homepage ? "Homepage" : "Open on GitHub"} <ExternalLink style={{ width: 12, height: 12, verticalAlign: "-2px" }}/></a>
        </div>
        <p style={{ margin: "14px 0 4px" }}>{repository.description || "No description provided."}</p>
        {(repository.topics ?? []).length ? <div className="cluster" style={{ marginTop: 10 }}>{repository.topics.map((topic) => <span className="tag" key={topic}><Tag/>{topic}</span>)}</div> : null}
        <dl className="stats">
          <div><dt><span className="language-dot" style={{ background: languageColor(repository.language) }}/>Language</dt><dd>{repository.language ?? "—"}</dd></div>
          <div><dt><Star/> Stars</dt><dd>{formatNumber(repository.stars)}</dd></div>
          <div><dt><GitFork/> Forks</dt><dd>{formatNumber(repository.forks)}</dd></div>
          <div><dt><CircleDot/> Open issues</dt><dd>{formatNumber(repository.openIssues)}</dd></div>
          <div><dt><Scale/> License</dt><dd>{repository.licenseName ?? repository.license ?? "—"}</dd></div>
          <div><dt><GitBranch/> Default branch</dt><dd><code>{repository.defaultBranch}</code></dd></div>
          <div><dt><History/> Last push</dt><dd><time dateTime={repository.pushedAt ?? repository.updatedAt}>{relativeTime(repository.pushedAt ?? repository.updatedAt)}</time></dd></div>
          <div><dt><LockKeyhole/> Visibility</dt><dd>{repository.visibility}</dd></div>
        </dl>
      </Card>
      <div className="stack">
        <Panel>
          <PanelHead title="Jump in" icon={<Radar/>}/>
          <div className="panel-body stack-sm">
            <ButtonLink href={`${base}/code`} variant="primary"><BookOpen/> Explore code</ButtonLink>
            <ButtonLink href={`${base}/commits`}><GitCommitHorizontal/> Commit history</ButtonLink>
            <ButtonLink href={`${base}/radar`}><Radar/> Run repository radar</ButtonLink>
            <ButtonLink href={`${base}/pulls`}><GitFork/> Review pull requests</ButtonLink>
          </div>
        </Panel>
        <Card>
          <span className="card-label">Created</span>
          <p style={{ margin: "8px 0 14px" }}><Calendar style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }}/>{formatDate(repository.createdAt)}</p>
          <span className="card-label">Size</span>
          <p style={{ margin: "8px 0 0" }}>{repository.sizeKb ? formatBytes(repository.sizeKb * 1024) : "—"}</p>
        </Card>
      </div>
    </div>
    {readmeError ? <ErrorState title="README could not be loaded" message="Repository details remain available. Retry this page when GitHub is reachable."/> : readme ? <ReadmeViewer data={readme}/> : null}
    <p className="muted text-xs">Repository metadata reflects GitHub’s current state for {owner}/{repo}. <Link href={`${base}/radar`} style={{ textDecoration: "underline" }}>Run a full audit</Link> for a health score, secret scan, and contributor analysis.</p>
  </div>;
}
