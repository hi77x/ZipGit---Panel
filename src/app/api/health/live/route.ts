import { handleApi } from "@/server/api-handler";
import { runtimeInfo } from "@/server/runtime-info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, async () => ({ status: "alive" as const, version: runtimeInfo.version, commit: runtimeInfo.commit }));
}
