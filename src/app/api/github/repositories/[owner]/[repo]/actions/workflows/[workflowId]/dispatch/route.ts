import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ActionsService } from "@/server/services/actions-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bodySchema = z.object({ ref: z.string().min(1).max(255), inputs: z.record(z.string(), z.string()).default({}) });

export async function POST(request: Request, { params }: { params: Promise<{ owner: string; repo: string; workflowId: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, workflowId } = await params;
    const input = bodySchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AppError("WORKFLOW_DISPATCH_INVALID", "Invalid workflow dispatch values.", 400);
    const github = await githubFor(context);
    const data = await new ActionsService(github).dispatch(owner, repo, Number(workflowId), input.data);
    syncRateLimit(context, github);
    return data;
  });
}
