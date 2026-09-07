import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { RepositoryService } from "@/server/services/repository-service";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { encodeGitHubSegment } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const actionSchema = z.object({ action: z.enum(["rerun", "rerun-failed", "cancel"]) });

export async function POST(request: Request, { params }: { params: Promise<{ owner: string; repo: string; runId: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, runId } = await params;
    const id = Number(runId), parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!Number.isSafeInteger(id) || id <= 0 || !parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid workflow run action.", 400);
    const github = await githubFor(context);
    await new RepositoryService(github).assertAccessible(owner, repo);
    const suffix = parsed.data.action === "cancel" ? "cancel" : parsed.data.action === "rerun-failed" ? "rerun-failed-jobs" : "rerun";
    try {
      await github.request({ method: "POST", path: `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/actions/runs/${id}/${suffix}`, schema: z.null(), endpointTemplate: "/repos/{owner}/{repo}/actions/runs/{id}/{action}" });
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw mapGitHubError(error, "WORKFLOW_RUN_NOT_FOUND");
      if (error instanceof GitHubApiError && (error.details.status === 409 || error.details.status === 422)) return { accepted: false as const, stale: true as const };
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "ACTIONS_WRITE_PERMISSION_REQUIRED");
      throw error;
    }
    syncRateLimit(context, github);
    return { accepted: true as const, stale: false as const };
  });
}
