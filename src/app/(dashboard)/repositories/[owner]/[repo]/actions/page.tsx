import { ActionsPanel } from "@/features/actions-panel/actions-panel";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";

export default async function ActionsPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const { accessToken } = await requireGitHubSession();
  const detail = await new RepositoryService(new GitHubClient(accessToken, crypto.randomUUID())).detail(owner, repo);
  return <ActionsPanel owner={owner} repo={repo} defaultBranch={detail.defaultBranch}/>;
}
