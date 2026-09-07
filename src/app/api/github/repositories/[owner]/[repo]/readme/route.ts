import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ReadmeService } from "@/server/services/readme-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const ref = new URL(request.url).searchParams.get("ref") ?? "main";
    const github = await githubFor(context);
    const data = await new ReadmeService(github).get(owner, repo, ref);
    syncRateLimit(context, github);
    return data;
  });
}
