import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ActionsService } from "@/server/services/actions-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const query = new URL(request.url).searchParams;
    const page = Number(query.get("page") ?? 1);
    const workflowId = query.has("workflowId") ? Number(query.get("workflowId")) : undefined;
    if (!Number.isSafeInteger(page) || page < 1 || workflowId !== undefined && (!Number.isSafeInteger(workflowId) || workflowId <= 0)) throw new AppError("VALIDATION_ERROR", "Invalid Actions query.", 400);
    const github = await githubFor(context);
    const data = await new ActionsService(github).runs(owner, repo, { page, workflowId, status: query.get("status") ?? undefined, branch: query.get("branch") ?? undefined });
    syncRateLimit(context, github);
    return data;
  });
}
