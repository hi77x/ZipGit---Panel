import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { IssueService, parseCreateIssue } from "@/server/services/issue-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  state: z.enum(["open", "closed", "all"]).default("open"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30)
});

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid issue filters.", 400);
    const github = await githubFor(context);
    const data = await new IssueService(github).list(owner, repo, parsed.data);
    syncRateLimit(context, github);
    return data;
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const input = parseCreateIssue(await request.json().catch(() => null));
    const github = await githubFor(context);
    const data = await new IssueService(github).create(owner, repo, input);
    syncRateLimit(context, github);
    return data;
  });
}
