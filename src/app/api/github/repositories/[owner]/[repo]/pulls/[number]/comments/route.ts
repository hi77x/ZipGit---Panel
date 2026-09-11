import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { PullService, parsePullNumber } from "@/server/services/pull-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commentSchema = z.object({
  body: z.string().trim().min(1, "Enter a comment.").max(65536, "Comments must be 65,536 characters or fewer."),
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).optional()
});

type Params = { params: Promise<{ owner: string; repo: string; number: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const { owner, repo, number } = await params;
    const github = await githubFor(context);
    const data = await new PullService(github).comments(owner, repo, parsePullNumber(number));
    syncRateLimit(context, github);
    return data;
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const parsed = commentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Review the comment fields.", 400, false, fieldErrors(parsed.error));
    const { owner, repo, number } = await params;
    const github = await githubFor(context);
    const data = await new PullService(github).createComment(owner, repo, parsePullNumber(number), parsed.data);
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
