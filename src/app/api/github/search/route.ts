import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { SearchService, type SearchTab } from "@/server/services/search-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tabs: SearchTab[] = ["repositories", "code", "issues"];

export async function GET(request: Request) {
  return handleApi(request, async (context) => {
    const searchParams = new URL(request.url).searchParams;
    const rawTab = searchParams.get("tab");
    const tab = tabs.includes(rawTab as SearchTab) ? rawTab as SearchTab : "repositories";
    const query = searchParams.get("q") ?? "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const github = await githubFor(context);
    const data = await new SearchService(github).search({ query, tab, page });
    syncRateLimit(context, github);
    return data;
  });
}
