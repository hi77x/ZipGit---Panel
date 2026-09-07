import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { RepositoryService } from "@/server/services/repository-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, async (context) => {
    const github = await githubFor(context);
    const data = await new RepositoryService(github).viewer();
    syncRateLimit(context, github);
    return data;
  });
}
