import { handleApi } from "@/server/api-handler";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(request, async () => ({ status: "healthy" as const }));
}
