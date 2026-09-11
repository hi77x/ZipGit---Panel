import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ContentService, deleteFileSchema, writeFileSchema, zodFieldErrors } from "@/server/services/content-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const query = new URL(request.url).searchParams;
    const ref = query.get("ref") ?? undefined;
    const path = query.get("path") ?? "";
    const recursive = query.get("recursive") === "1";
    const github = await githubFor(context);
    const service = new ContentService(github);
    const data = path && !recursive ? await service.file(owner, repo, ref, path) : await service.tree(owner, repo, ref, path, recursive);
    syncRateLimit(context, github);
    return data;
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const parsed = writeFileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Provide a valid path, content, message, and branch.", 400, false, zodFieldErrors(parsed.error));
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new ContentService(github).write(owner, repo, parsed.data);
    syncRateLimit(context, github);
    return data;
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const parsed = deleteFileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Provide a valid path, message, branch, and revision.", 400, false, zodFieldErrors(parsed.error));
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new ContentService(github).remove(owner, repo, parsed.data);
    syncRateLimit(context, github);
    return data;
  });
}
