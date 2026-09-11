import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { CommitService } from "@/server/services/commit-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string; sha: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, sha } = await params;
    const github = await githubFor(context);
    const data = await new CommitService(github).detail(owner, repo, sha);
    syncRateLimit(context, github);
    return data;
  });
}
