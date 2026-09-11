import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const coreSchema = z.object({
  limit: z.number(), used: z.number(), remaining: z.number(), reset: z.number()
});

export async function GET(request: Request) {
  return handleApi(request, async (context) => {
    const github = await githubFor(context);
    const result = await github.request({ path: "/rate_limit", schema: z.object({ resources: z.object({ core: coreSchema }) }), endpointTemplate: "/rate_limit" });
    syncRateLimit(context, github);
    const core = result.data.resources.core;
    return { limit: core.limit, used: core.used, remaining: core.remaining, resetAt: core.reset ? new Date(core.reset * 1000).toISOString() : null };
  });
}
