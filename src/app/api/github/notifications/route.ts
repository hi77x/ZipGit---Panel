import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { NotificationService } from "@/server/services/notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, async (context) => {
    const searchParams = new URL(request.url).searchParams;
    const all = searchParams.get("all") !== "false";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 30));
    const github = await githubFor(context);
    const data = await new NotificationService(github).list({ all, page, perPage });
    syncRateLimit(context, github);
    return data;
  });
}
