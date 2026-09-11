import { z } from "zod";
import { ErrorState } from "@/components/feedback/states";
import { PullForm } from "@/features/pulls/pull-form";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";
import { encodeGitHubSegment } from "@/lib/url";

const branchesSchema = z.array(z.object({ name: z.string() }));

export default async function NewPullPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  let defaultBranch = "main";
  let branches: string[] = [];
  try {
    const { accessToken } = await requireGitHubSession();
    const github = new GitHubClient(accessToken, crypto.randomUUID());
    defaultBranch = (await new RepositoryService(github).detail(owner, repo)).defaultBranch;
    try {
      const result = await github.request({
        path: `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/branches`,
        query: { per_page: 100 },
        schema: branchesSchema,
        endpointTemplate: "/repos/{owner}/{repo}/branches"
      });
      branches = result.data.map((branch) => branch.name);
    } catch { branches = []; }
  } catch {
    return <ErrorState message="The repository could not be loaded from GitHub."/>;
  }
  return <section>
    <header className="section-heading"><div><h2>New pull request</h2><p>Open a pull request between two branches in {owner}/{repo}.</p></div></header>
    <PullForm owner={owner} repo={repo} defaultBranch={defaultBranch} branches={branches}/>
  </section>;
}
