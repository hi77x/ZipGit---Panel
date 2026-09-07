import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { PagesService } from "@/server/services/pages-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new PagesService(github).build(owner, repo);
    syncRateLimit(context, github);
    return data;
  });
}
