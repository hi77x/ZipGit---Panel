import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { RepositoryService } from "@/server/services/repository-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new RepositoryService(github).detail(owner, repo);
    syncRateLimit(context, github);
    return data;
  });
}
