import "server-only";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";

export async function createGitHubContext(requestId: string) {
  const session = await requireGitHubSession();
  return { ...session, github: new GitHubClient(session.accessToken, requestId) };
}
