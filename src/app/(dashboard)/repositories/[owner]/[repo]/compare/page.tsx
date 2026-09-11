import { ArrowDown, ArrowUp, GitCommitHorizontal, Minus, Plus } from "lucide-react";
import { DiffViewer } from "@/components/diff/diff-viewer";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/card";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { CommitService } from "@/server/services/commit-service";
import { totalDiffStats } from "@/lib/diff";
import { formatNumber } from "@/lib/format";
import { isSafeGitHubRef } from "@/lib/url";

export default async function ComparePage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ base?: string; head?: string }> }) {
  const { owner, repo } = await params;
  const query = await searchParams;
  const baseRef = (query.base ?? "").trim();
  const headRef = (query.head ?? "").trim();
  const path = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare`;
  if (!baseRef || !headRef) return <section>
    <header className="section-heading">
      <div>
        <h2>Compare refs</h2>
        <p>Choose a base ref and a head ref to review the differences across {owner}/{repo}.</p>
      </div>
    </header>
    <form className="form-grid" action={path} method="get">
      <label className="field"><span>Base ref</span><input name="base" placeholder="main" defaultValue={baseRef} required/></label>
      <label className="field"><span>Head ref</span><input name="head" placeholder="feature/branch" defaultValue={headRef} required/></label>
      <div className="full-field row-actions"><Button type="submit" variant="primary">Compare refs</Button></div>
    </form>
  </section>;
  if (!isSafeGitHubRef(baseRef) || !isSafeGitHubRef(headRef)) return <ErrorState message="Choose valid Git references to compare."/>;
  let compare: Awaited<ReturnType<CommitService["compare"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    compare = await new CommitService(new GitHubClient(accessToken, crypto.randomUUID())).compare(owner, repo, baseRef, headRef);
  } catch {
    return <ErrorState title="Comparison failed" message="GitHub could not compare these refs. Check that both exist in this repository."/>;
  }
  if (!compare) return <ErrorState title="Comparison failed" message="GitHub could not compare these refs."/>;
  const totals = totalDiffStats(compare.files);
  return <section>
    <header className="section-heading">
      <div>
        <h2>{baseRef}...{headRef}</h2>
        <p>Comparing {baseRef} to {headRef} in {owner}/{repo}.</p>
      </div>
    </header>
    <div className="metric-grid">
      <Metric label="Ahead" value={formatNumber(compare.aheadBy)} icon={<ArrowUp/>}/>
      <Metric label="Behind" value={formatNumber(compare.behindBy)} icon={<ArrowDown/>}/>
      <Metric label="Total commits" value={formatNumber(compare.totalCommits)} icon={<GitCommitHorizontal/>}/>
      <Metric label="Additions" value={<span className="diff-add-count">+{formatNumber(totals.additions)}</span>} icon={<Plus/>}/>
      <Metric label="Deletions" value={<span className="diff-del-count">−{formatNumber(totals.deletions)}</span>} icon={<Minus/>}/>
    </div>
    <div style={{ marginTop: 18 }}>
      {compare.status === "identical" ? <EmptyState title="No differences" message="Both refs point to the same commit, so there is nothing to compare."/> : <DiffViewer files={compare.files} storageKey={`${owner}/${repo}/compare/${baseRef}...${headRef}`}/>}
    </div>
  </section>;
}
