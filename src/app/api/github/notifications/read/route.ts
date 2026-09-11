import { z } from "zod";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { NotificationService } from "@/server/services/notification-service";
import { AppError } from "@/shared/contracts/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ids: z.array(z.string().regex(/^\d+$/)).max(50).optional(),
  all: z.boolean().optional()
});

export async function POST(request: Request) {
  return handleApi(request, async (context) => {
    const input = bodySchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AppError("VALIDATION_ERROR", "Provide notification ids or mark all as read.", 400);
    const github = await githubFor(context);
    const data = await new NotificationService(github).markRead(input.data);
    syncRateLimit(context, github);
    return data;
  });
}
