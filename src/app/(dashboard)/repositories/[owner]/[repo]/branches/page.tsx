import { GitBranch, GitCompareArrows, GitFork, Terminal } from "lucide-react";
import { ErrorState, PermissionState } from "@/components/feedback/states";
import { Badge, Panel, PanelHead } from "@/components/ui/card";
import { BranchManager } from "@/features/branches/branch-manager";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { BranchService } from "@/server/services/branch-service";
import { RepositoryService } from "@/server/services/repository-service";
import { AppError } from "@/shared/contracts/api-error";

export default async function BranchesPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  let data: { branches: Awaited<ReturnType<BranchService["list"]>>["branches"]; defaultBranch: string } | null = null;
  let loadError: unknown;
  try {
    const { accessToken } = await requireGitHubSession();
    const github = new GitHubClient(accessToken, crypto.randomUUID());
    await new RepositoryService(github).assertAccessible(owner, repo);
    data = await new BranchService(github).list(owner, repo);
  } catch (error) {
    loadError = error;
  }
  if (loadError || !data) {
    if (loadError instanceof AppError && (loadError.code === "UNAUTHENTICATED" || loadError.code === "AUTH_RECONNECT_REQUIRED")) return <PermissionState message={loadError.message}/>;
    return <ErrorState title="Branches unavailable" message="GitHub did not return the branch list for this repository."/>;
  }
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return <div className="stack">
    <div className="spread" style={{ flexWrap: "wrap", gap: 12 }}>
      <div>
        <span className="eyebrow"><GitBranch/> Ref management</span>
        <h2 style={{ margin: 0 }}>Branches</h2>
        <p className="muted text-sm" style={{ margin: "4px 0 0" }}>Create branches from any ref, jump into the code explorer, or compare a branch against <code>{data.defaultBranch}</code>.</p>
      </div>
      <div className="row-actions">
        <a className="button" href={`${base}/compare?base=${encodeURIComponent(data.defaultBranch)}`}><GitCompareArrows/> Compare branches</a>
      </div>
    </div>
    <BranchManager owner={owner} repo={repo} branches={data.branches} defaultBranch={data.defaultBranch}/>
    <Panel>
      <PanelHead title="Branch workflow tips" icon={<GitFork/>}/>
      <div className="panel-body stack-sm text-sm muted">
        <p style={{ margin: 0 }}><Terminal style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }}/>Create a branch here, then edit files in the Code tab. Every save becomes a signed GitHub commit through your OAuth session.</p>
        <p style={{ margin: 0 }}>The default branch <Badge tone="accent">{data.defaultBranch}</Badge> is protected from deletion in this panel to prevent accidents.</p>
      </div>
    </Panel>
  </div>;
}
