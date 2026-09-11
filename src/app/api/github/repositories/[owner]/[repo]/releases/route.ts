import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ReleaseService, releaseCreateSchema } from "@/server/services/release-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
    const github = await githubFor(context);
    const data = await new ReleaseService(github).list(owner, repo, page);
    syncRateLimit(context, github);
    return data;
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const input = releaseCreateSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AppError("RELEASE_INVALID", "Invalid release values.", 400);
    const github = await githubFor(context);
    const data = await new ReleaseService(github).create(owner, repo, input.data);
    syncRateLimit(context, github);
    return data;
  });
}
