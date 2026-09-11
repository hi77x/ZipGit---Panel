import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { BranchService, createBranchSchema } from "@/server/services/branch-service";
import { zodFieldErrors } from "@/server/services/content-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new BranchService(github).list(owner, repo);
    syncRateLimit(context, github);
    return data;
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const parsed = createBranchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("INVALID_BRANCH_NAME", "Provide a valid branch name and base.", 400, false, zodFieldErrors(parsed.error));
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new BranchService(github).create(owner, repo, parsed.data);
    syncRateLimit(context, github);
    return data;
  });
}
