import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { ButtonLink } from "@/components/ui/button";
import { IssueList } from "@/features/issues/issue-list";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { IssueService } from "@/server/services/issue-service";

const stateFilters = ["open", "closed", "all"] as const;
type StateFilter = (typeof stateFilters)[number];

export default async function IssuesPage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ state?: string; page?: string }> }) {
  const { owner, repo } = await params;
  const query = await searchParams;
  const state: StateFilter = stateFilters.includes(query.state as StateFilter) ? (query.state as StateFilter) : "open";
  const page = Math.max(1, Number(query.page) || 1);
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;
  let data: Awaited<ReturnType<IssueService["list"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new IssueService(new GitHubClient(accessToken, crypto.randomUUID())).list(owner, repo, { state, page, perPage: 30 });
  } catch {
    return <section><header className="section-heading"><div><h2>Issues</h2><p>Issues could not be loaded from GitHub.</p></div></header><ErrorState message="Issues could not be loaded from GitHub."/></section>;
  }
  if (!data) return <ErrorState message="Issues could not be loaded from GitHub."/>;
  const chipLabels: Record<StateFilter, string> = { open: "Open", closed: "Closed", all: "All" };
  return <section>
    <header className="section-heading">
      <div><h2>Issues</h2><p>{data.openCount} open · {data.closedCount} closed</p></div>
      <ButtonLink href={`${base}/new`} variant="primary"><Plus/> New issue</ButtonLink>
    </header>
    <nav className="filter-chips" aria-label="Filter issues by state">{stateFilters.map((filter) => <Link key={filter} href={`${base}?state=${filter}`} aria-current={state === filter ? "page" : undefined}>{chipLabels[filter]}</Link>)}</nav>
    {data.issues.length ? <IssueList issues={data.issues} owner={owner} repo={repo}/> : <EmptyState title="No issues" message={state === "closed" ? "No closed issues match this filter." : state === "all" ? "This repository has no issues yet." : "No issues are currently open."}/>}
    <nav className="pagination" aria-label="Issue pages">
      {page > 1 ? <ButtonLink href={`${base}?state=${state}&page=${page - 1}`}>Previous</ButtonLink> : <span/>}
      {data.hasNext ? <ButtonLink href={`${base}?state=${state}&page=${page + 1}`}>Next</ButtonLink> : null}
    </nav>
  </section>;
}
