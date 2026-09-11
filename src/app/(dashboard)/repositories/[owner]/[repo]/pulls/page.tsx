import Link from "next/link";
import { GitPullRequest } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/states";
import { PullList } from "@/features/pulls/pull-list";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { PullService } from "@/server/services/pull-service";

const states = ["open", "closed", "all"] as const;

export default async function PullsPage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ state?: string; page?: string }> }) {
  const { owner, repo } = await params;
  const query = await searchParams;
  const state = states.find((candidate) => candidate === query.state) ?? "open";
  const page = Math.max(1, Number(query.page) || 1);
  let data: Awaited<ReturnType<PullService["list"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new PullService(new GitHubClient(accessToken, crypto.randomUUID())).list(owner, repo, { state, page, perPage: 30 });
  } catch { return <ErrorState message="Pull requests could not be loaded from GitHub."/>; }
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
  return <section>
    <header className="section-heading">
      <div><h2>Pull requests</h2><p>Review diffs, discuss changes, and merge branches without leaving RepoDeck.</p></div>
      <ButtonLink href={`${base}/new`} variant="primary"><GitPullRequest/> New pull request</ButtonLink>
    </header>
    <nav className="filter-chips" aria-label="Filter pull requests">
      {states.map((value) => <Link key={value} href={`${base}?state=${value}`} aria-current={state === value ? "page" : undefined}>{value === "open" ? "Open" : value === "closed" ? "Closed" : "All"}</Link>)}
    </nav>
    <PullList pulls={data.pulls} owner={owner} repo={repo}/>
    <nav className="pagination" aria-label="Pull request pages">
      {page > 1 ? <ButtonLink href={`${base}?state=${state}&page=${page - 1}`}>Previous</ButtonLink> : <span/>}
      {data.hasNext ? <ButtonLink href={`${base}?state=${state}&page=${page + 1}`}>Next</ButtonLink> : null}
    </nav>
  </section>;
}
