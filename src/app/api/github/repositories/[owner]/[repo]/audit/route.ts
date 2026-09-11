import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { AuditService } from "@/server/services/audit-service";
import { AppError } from "@/shared/contracts/api-error";
import { isSafeGitHubRef } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const value = new URL(request.url).searchParams.get("ref");
    const ref = value ? value : undefined;
    if (ref !== undefined && !isSafeGitHubRef(ref)) throw new AppError("VALIDATION_ERROR", "Invalid Git reference.", 400, false, { ref: "Invalid ref" });
    const github = await githubFor(context);
    const data = await new AuditService(github).audit(owner, repo, ref);
    syncRateLimit(context, github);
    return data;
  });
}
