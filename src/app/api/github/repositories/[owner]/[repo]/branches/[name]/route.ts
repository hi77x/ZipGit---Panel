import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { BranchService } from "@/server/services/branch-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ owner: string; repo: string; name: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, name } = await params;
    const github = await githubFor(context);
    const data = await new BranchService(github).remove(owner, repo, name);
    syncRateLimit(context, github);
    return data;
  });
}
