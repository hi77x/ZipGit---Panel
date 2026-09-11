import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { IssueService, parseCommentBody } from "@/server/services/issue-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pageSchema = z.coerce.number().int().min(1).default(1);

function issueNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new AppError("ISSUE_NOT_FOUND", "The issue was not found.", 404);
  return parsed;
}

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string; number: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, number } = await params;
    const id = issueNumber(number);
    const parsed = pageSchema.safeParse(new URL(request.url).searchParams.get("page") ?? undefined);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid comment page.", 400);
    const github = await githubFor(context);
    const data = await new IssueService(github).comments(owner, repo, id, parsed.data);
    syncRateLimit(context, github);
    return data;
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ owner: string; repo: string; number: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, number } = await params;
    const id = issueNumber(number);
    const body = parseCommentBody(await request.json().catch(() => null));
    const github = await githubFor(context);
    const data = await new IssueService(github).addComment(owner, repo, id, body);
    syncRateLimit(context, github);
    return data;
  });
}
