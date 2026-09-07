import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ActivityService } from "@/server/services/activity-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowedTypes = new Set(["all", "PushEvent", "PullRequestEvent", "IssuesEvent", "IssueCommentEvent", "ReleaseEvent", "CreateEvent", "DeleteEvent", "ForkEvent", "WatchEvent"]);

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1), perPage = Number(url.searchParams.get("perPage") ?? 30);
    const type = url.searchParams.get("type") ?? "all";
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100 || !allowedTypes.has(type)) throw new AppError("VALIDATION_ERROR", "Invalid activity query.", 400);
    const github = await githubFor(context);
    const data = await new ActivityService(github).list(owner, repo, page, perPage, type);
    syncRateLimit(context, github);
    return data;
  });
}
