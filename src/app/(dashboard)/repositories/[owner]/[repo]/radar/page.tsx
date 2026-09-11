import { ErrorState, PermissionState } from "@/components/feedback/states";
import { RadarView } from "@/features/radar/radar-view";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { AuditService } from "@/server/services/audit-service";
import { AppError } from "@/shared/contracts/api-error";
import { isSafeGitHubRef } from "@/lib/url";

const permissionCodes = new Set(["UNAUTHENTICATED", "AUTH_RECONNECT_REQUIRED", "INSUFFICIENT_GITHUB_SCOPE", "GITHUB_PERMISSION_DENIED", "GITHUB_RATE_LIMITED", "AUDIT_FAILED"]);

export default async function RepositoryRadarPage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { owner, repo } = await params;
  const query = await searchParams;
  const ref = query.ref && isSafeGitHubRef(query.ref) ? query.ref : undefined;
  let report: Awaited<ReturnType<AuditService["audit"]>> | null = null;
  let failure: unknown;
  try {
    const { accessToken } = await requireGitHubSession();
    report = await new AuditService(new GitHubClient(accessToken, crypto.randomUUID())).audit(owner, repo, ref);
  } catch (error) {
    failure = error;
  }
  if (!report) {
    if (failure instanceof AppError && permissionCodes.has(failure.code)) return <PermissionState message={failure.message}/>;
    return <ErrorState message="Repository radar could not complete. The repository may be empty or GitHub may be unreachable."/>;
  }
  return <RadarView report={report} owner={owner} repo={repo} gitRef={ref ?? null}/>;
}
