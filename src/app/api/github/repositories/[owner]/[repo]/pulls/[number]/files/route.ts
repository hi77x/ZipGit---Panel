import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { PullService, parsePullNumber } from "@/server/services/pull-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ owner: string; repo: string; number: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const { owner, repo, number } = await params;
    const github = await githubFor(context);
    const data = await new PullService(github).files(owner, repo, parsePullNumber(number));
    syncRateLimit(context, github);
    return data;
  });
}
