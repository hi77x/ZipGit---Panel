import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { CommitService } from "@/server/services/commit-service";
import { isSafeGitHubRef } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const query = new URL(request.url).searchParams;
    const ref = query.get("ref") ?? "";
    const page = Number(query.get("page") ?? 1);
    const perPage = Number(query.get("perPage") ?? 30);
    if (!isSafeGitHubRef(ref) || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) throw new AppError("VALIDATION_ERROR", "Invalid commits query.", 400);
    const github = await githubFor(context);
    const data = await new CommitService(github).list(owner, repo, { ref, page, perPage });
    syncRateLimit(context, github);
    return data;
  });
}
