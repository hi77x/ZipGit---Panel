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
    const base = (query.get("base") ?? "").trim();
    const head = (query.get("head") ?? "").trim();
    if (!isSafeGitHubRef(base) || !isSafeGitHubRef(head)) throw new AppError("VALIDATION_ERROR", "Invalid compare refs.", 400, false, { base: "Invalid base", head: "Invalid head" });
    const github = await githubFor(context);
    const data = await new CommitService(github).compare(owner, repo, base, head);
    syncRateLimit(context, github);
    return data;
  });
}
