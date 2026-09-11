import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { IssueService, parseUpdateIssue } from "@/server/services/issue-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function issueNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new AppError("ISSUE_NOT_FOUND", "The issue was not found.", 404);
  return parsed;
}

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string; number: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, number } = await params;
    const id = issueNumber(number);
    const github = await githubFor(context);
    const data = await new IssueService(github).detail(owner, repo, id);
    syncRateLimit(context, github);
    return data;
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ owner: string; repo: string; number: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, number } = await params;
    const id = issueNumber(number);
    const input = parseUpdateIssue(await request.json().catch(() => null));
    const github = await githubFor(context);
    const data = await new IssueService(github).update(owner, repo, id, input);
    syncRateLimit(context, github);
    return data;
  });
}
