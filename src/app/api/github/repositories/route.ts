import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { RepositoryService } from "@/server/services/repository-service";
import { repositoryQuerySchema } from "@/shared/contracts/repository";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, async (context) => {
    const url = new URL(request.url);
    const parsed = repositoryQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid repository query.", 400);
    const github = await githubFor(context);
    const data = await new RepositoryService(github).list(parsed.data);
    syncRateLimit(context, github);
    return data;
  });
}
