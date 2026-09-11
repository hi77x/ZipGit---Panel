import Link from "next/link";
import { BookMarked, CircleDot, ExternalLink, FileCode2, GitPullRequest, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { RepositoryCard } from "@/features/repository-list/repository-card";
import { SearchWorkspace } from "@/features/search/search-workspace";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { SearchService, type SearchTab } from "@/server/services/search-service";

const tabs = [
  { id: "repositories", label: "Repositories", icon: BookMarked },
  { id: "code", label: "Code", icon: FileCode2 },
  { id: "issues", label: "Issues", icon: GitPullRequest }
] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const tab: SearchTab = params.tab === "code" || params.tab === "issues" ? params.tab : "repositories";
  const page = Math.max(1, Number(params.page) || 1);

  if (!query) return <div className="page">
    <header className="page-header">
      <div><span className="eyebrow"><Search/> Global search</span><h1>Search GitHub</h1><p>Search across every repository the connected account can access: repositories, code, issues, and pull requests.</p></div>
    </header>
    <SearchWorkspace/>
  </div>;

  let data: Awaited<ReturnType<SearchService["search"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new SearchService(new GitHubClient(accessToken, crypto.randomUUID())).search({ query, tab, page });
  } catch {
    return <div className="page">
      <header className="page-header"><div><span className="eyebrow"><Search/> Global search</span><h1>Search GitHub</h1></div></header>
      <ErrorState message="Search could not be completed. Refine the query and try again."/>
    </div>;
  }

  const counts: Record<SearchTab, number> = { repositories: data.repositories.length, code: data.code.length, issues: data.issues.length };
  const empty = counts[tab] === 0;
  const base = `/search?q=${encodeURIComponent(query)}`;

  return <div className="page">
    <header className="page-header">
      <div><span className="eyebrow"><Search/> Global search</span><h1>Results for “{query}”</h1><p>Matching {tab} from GitHub search. Switch tabs to widen or narrow the result type.</p></div>
      <ButtonLink href="/search">New search</ButtonLink>
    </header>

    <form className="search-form" action="/search">
      <Search aria-hidden="true"/>
      <label className="sr-only" htmlFor="result-search">Search GitHub</label>
      <input id="result-search" name="q" defaultValue={query} autoComplete="off"/>
      <input type="hidden" name="tab" value={tab}/>
      <button className="button button-secondary" type="submit">Search</button>
    </form>

    <nav className="tabs" aria-label="Search result types">
      {tabs.map(({ id, label, icon: Icon }) => <Link key={id} className="tab" href={`${base}&tab=${id}`} aria-current={tab === id ? "page" : undefined}><Icon aria-hidden="true"/>{label}{counts[id] ? <span className="tab-count">{counts[id]}</span> : null}</Link>)}
    </nav>

    {empty ? <EmptyState title="No results" message={`No ${tab} matched “${query}”. Try a broader query or a different result type.`}/> : null}

    {tab === "repositories" && data.repositories.length ? <div className="grid">{data.repositories.map((repository) => <RepositoryCard key={repository.id} repository={repository}/>)}</div> : null}

    {tab === "code" && data.code.length ? <div className="issue-list">{data.code.map((result) => <article className="issue-row" key={`${result.repository.fullName}/${result.path}`}>
      <FileCode2 className="state-icon" aria-hidden="true"/>
      <div>
        <span className="issue-title mono break-anywhere">{result.path}</span>
        <div className="issue-meta">
          <Link href={`/repositories/${encodeURIComponent(result.repository.owner)}/${encodeURIComponent(result.repository.name)}`}>{result.repository.fullName}</Link>
          <span>{result.name}</span>
          <code>{result.sha.slice(0, 7)}</code>
        </div>
      </div>
      <a className="button button-sm" href={result.url} target="_blank" rel="noopener noreferrer"><ExternalLink/>Open</a>
    </article>)}</div> : null}

    {tab === "issues" && data.issues.length ? <div className="issue-list">{data.issues.map((issue) => <article className="issue-row" key={`${issue.repository.fullName}#${issue.number}`}>
      <CircleDot className={`state-icon state-${issue.state}`} aria-hidden="true"/>
      <div>
        <span className="issue-title">#{issue.number} {issue.title}</span>
        <div className="issue-meta"><span>{issue.repository.fullName}</span><span>{issue.state}</span></div>
      </div>
      <a className="button button-sm" href={issue.url} target="_blank" rel="noopener noreferrer"><ExternalLink/>Open</a>
    </article>)}</div> : null}

    <nav className="pagination" aria-label="Search result pages">
      {page > 1 ? <ButtonLink href={`${base}&tab=${tab}&page=${page - 1}`}>Previous</ButtonLink> : <span/>}
      {data.hasNext ? <ButtonLink href={`${base}&tab=${tab}&page=${page + 1}`}>Next</ButtonLink> : null}
    </nav>
  </div>;
}
