import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { PullService, parsePullNumber } from "@/server/services/pull-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({ state: z.enum(["open", "closed"]) });

type Params = { params: Promise<{ owner: string; repo: string; number: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const { owner, repo, number } = await params;
    const github = await githubFor(context);
    const data = await new PullService(github).detail(owner, repo, parsePullNumber(number));
    syncRateLimit(context, github);
    return data;
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Choose whether to open or close the pull request.", 400);
    const { owner, repo, number } = await params;
    const github = await githubFor(context);
    const data = await new PullService(github).setState(owner, repo, parsePullNumber(number), parsed.data.state);
    syncRateLimit(context, github);
    return data;
  });
}
