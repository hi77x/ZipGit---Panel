import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { PullService } from "@/server/services/pull-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const states = ["open", "closed", "all"] as const;
const createSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(256, "Titles must be 256 characters or fewer."),
  head: z.string().trim().min(1, "Choose a head branch.").max(200, "Head branches must be 200 characters or fewer."),
  base: z.string().trim().min(1, "Choose a base branch.").max(200, "Base branches must be 200 characters or fewer."),
  body: z.string().max(65536, "Descriptions must be 65,536 characters or fewer.").optional(),
  draft: z.boolean().optional()
});

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const query = new URL(request.url).searchParams;
    const state = states.find((candidate) => candidate === query.get("state")) ?? "open";
    const page = Number(query.get("page") ?? 1);
    const perPage = Number(query.get("perPage") ?? 30);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) {
      throw new AppError("VALIDATION_ERROR", "Invalid pull request query.", 400);
    }
    const github = await githubFor(context);
    const data = await new PullService(github).list(owner, repo, { state, page, perPage });
    syncRateLimit(context, github);
    return data;
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Review the pull request fields.", 400, false, fieldErrors(parsed.error));
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new PullService(github).create(owner, repo, parsed.data);
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
