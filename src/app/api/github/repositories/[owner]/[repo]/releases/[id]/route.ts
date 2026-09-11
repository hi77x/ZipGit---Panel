import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ReleaseService, releaseUpdateSchema } from "@/server/services/release-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ owner: string; repo: string; id: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, id } = await params;
    const input = releaseUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AppError("RELEASE_INVALID", "Invalid release values.", 400);
    const github = await githubFor(context);
    const data = await new ReleaseService(github).update(owner, repo, Number(id), input.data);
    syncRateLimit(context, github);
    return data;
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ owner: string; repo: string; id: string }> }) {
  return handleApi(request, async (context) => {
    const { owner, repo, id } = await params;
    const github = await githubFor(context);
    const data = await new ReleaseService(github).remove(owner, repo, Number(id));
    syncRateLimit(context, github);
    return data;
  });
}
