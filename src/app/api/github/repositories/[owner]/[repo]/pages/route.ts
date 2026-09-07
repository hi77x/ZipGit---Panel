import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { PagesService } from "@/server/services/pages-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("workflow") }),
  z.object({ mode: z.literal("branch"), branch: z.string().min(1).max(255), path: z.enum(["/", "/docs"]) })
]);

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(request, async (context) => {
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new PagesService(github).get(owner, repo);
    syncRateLimit(context, github);
    return data;
  });
}

async function mutate(request: Request, params: Params["params"], update: boolean) {
  return handleApi(request, async (context) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("PAGES_INVALID_SOURCE", "Choose a supported Pages source.", 400);
    const { owner, repo } = await params;
    const github = await githubFor(context);
    const data = await new PagesService(github).configure(owner, repo, parsed.data, update);
    syncRateLimit(context, github);
    return data;
  });
}

export async function POST(request: Request, { params }: Params) { return mutate(request, params, false); }
export async function PATCH(request: Request, { params }: Params) { return mutate(request, params, true); }
