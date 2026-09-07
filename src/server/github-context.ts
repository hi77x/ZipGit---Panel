import "server-only";
import type { ApiContext } from "./api-handler";
import { requireGitHubSession } from "./auth/require-session";
import { GitHubClient } from "./github/client";

export async function githubFor(context: ApiContext): Promise<GitHubClient> {
  const { accessToken } = await requireGitHubSession();
  return new GitHubClient(accessToken, context.requestId);
}

export function syncRateLimit(context: ApiContext, github: GitHubClient): void {
  const rate = github.lastRateLimit;
  context.rateLimit = rate ? { remaining: rate.remaining ?? 0, resetAt: rate.resetAt } : null;
}
