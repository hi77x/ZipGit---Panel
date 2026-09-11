import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { RepositoryService } from "@/server/services/repository-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return handleApi(_request, async (context) => {
    const github = await githubFor(context);
    const data = await new RepositoryService(github).starState(owner, repo);
    syncRateLimit(context, github);
    return data;
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return handleApi(request, async (context) => {
    const github = await githubFor(context);
    const data = await new RepositoryService(github).setStar(owner, repo, true);
    syncRateLimit(context, github);
    return data;
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return handleApi(request, async (context) => {
    const github = await githubFor(context);
    const data = await new RepositoryService(github).setStar(owner, repo, false);
    syncRateLimit(context, github);
    return data;
  });
}
