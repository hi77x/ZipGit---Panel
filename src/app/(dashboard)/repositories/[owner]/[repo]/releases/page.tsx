import { ReleaseManager } from "@/features/releases/release-manager";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { ReleaseService } from "@/server/services/release-service";

export default async function ReleasesPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const { accessToken } = await requireGitHubSession();
  const data = await new ReleaseService(new GitHubClient(accessToken, crypto.randomUUID())).list(owner, repo, 1);
  return <ReleaseManager owner={owner} repo={repo} releases={data.releases}/>;
}
