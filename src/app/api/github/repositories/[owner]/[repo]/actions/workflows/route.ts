import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ActionsService } from "@/server/services/actions-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
    const github = await githubFor(context);
    const data = await new ActionsService(github).workflows(owner, repo, Number.isSafeInteger(page) && page > 0 ? page : 1);
    syncRateLimit(context, github);
    return data;
  });
}
