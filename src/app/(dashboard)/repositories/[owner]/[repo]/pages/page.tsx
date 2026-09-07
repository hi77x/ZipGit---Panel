import { PagesPanel } from "@/features/pages-panel/pages-panel";
import { z } from "zod";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";

export default async function PagesPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const { accessToken } = await requireGitHubSession();
  const github = new GitHubClient(accessToken, crypto.randomUUID());
  const detail = await new RepositoryService(github).detail(owner, repo);
  let isNext = false;
  try {
    const file = await github.request({ path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/package.json`, schema: z.object({ content: z.string(), encoding: z.literal("base64") }), endpointTemplate: "/repos/{owner}/{repo}/contents/package.json" });
    const packageJson = JSON.parse(Buffer.from(file.data.content.replace(/\s/g, ""), "base64").toString("utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    isNext = Boolean(packageJson.dependencies?.next || packageJson.devDependencies?.next);
  } catch { /* framework detection is advisory and does not change repository availability */ }
  return <PagesPanel owner={owner} repo={repo} defaultBranch={detail.defaultBranch} isNext={isNext}/>;
}
