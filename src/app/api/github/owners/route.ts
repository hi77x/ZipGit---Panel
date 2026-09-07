import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { RepositoryService } from "@/server/services/repository-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, async (context) => {
    const github = await githubFor(context);
    const viewer = await new RepositoryService(github).viewer();
    const organizations = await github.request({ path: "/user/orgs", query: { per_page: 100 }, schema: z.array(z.object({ login: z.string(), avatar_url: z.string().nullable().optional() })), endpointTemplate: "/user/orgs" });
    syncRateLimit(context, github);
    return { owners: [{ login: viewer.login, type: "user" as const, avatarUrl: viewer.avatarUrl }, ...organizations.data.map((org) => ({ login: org.login, type: "organization" as const, avatarUrl: org.avatar_url ?? null }))] };
  });
}
