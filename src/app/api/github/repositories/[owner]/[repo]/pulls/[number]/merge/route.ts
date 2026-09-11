import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { PullService, parsePullNumber } from "@/server/services/pull-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mergeSchema = z.object({
  method: z.enum(["merge", "squash", "rebase"]),
  commitTitle: z.string().trim().max(256, "Commit titles must be 256 characters or fewer.").optional(),
  commitMessage: z.string().max(65536, "Commit messages must be 65,536 characters or fewer.").optional(),
  deleteBranch: z.boolean().optional()
});

type Params = { params: Promise<{ owner: string; repo: string; number: string }> };

export async function POST(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const parsed = mergeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Review the merge options.", 400, false, fieldErrors(parsed.error));
    const { owner, repo, number } = await params;
    const github = await githubFor(context);
    const data = await new PullService(github).merge(owner, repo, parsePullNumber(number), parsed.data);
    syncRateLimit(context, github);
    return data;
  });
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && result[field] === undefined) result[field] = issue.message;
  }
  return result;
}
