import "server-only";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { AppError } from "@/shared/contracts/api-error";
import type { NotificationDto } from "@/shared/contracts/misc";

const notificationSchema = z.object({
  id: z.string(),
  unread: z.boolean().default(false),
  reason: z.string(),
  updated_at: z.string(),
  subject: z.object({
    title: z.string(),
    type: z.string(),
    url: z.string().nullable().optional(),
    html_url: z.string().nullable().optional(),
    latest_comment_url: z.string().nullable().optional()
  }),
  repository: z.object({
    full_name: z.string(),
    name: z.string(),
    owner: z.object({ login: z.string(), avatar_url: z.string().nullable().optional() })
  }).nullable().optional()
});

export type NotificationListResult = {
  notifications: NotificationDto[];
  unreadCount: number;
  page: number;
  hasNext: boolean;
};

export class NotificationService {
  constructor(private readonly github: GitHubClient) {}

  async list(input: { all: boolean; page: number; perPage: number }): Promise<NotificationListResult> {
    try {
      const [result, unreadCount] = await Promise.all([
        this.github.request({
          path: "/notifications",
          query: { all: input.all ? "true" : "false", page: input.page, per_page: input.perPage },
          schema: z.array(notificationSchema),
          endpointTemplate: "/notifications"
        }),
        this.unreadCount()
      ]);
      return { notifications: result.data.map(toNotification), unreadCount, page: input.page, hasNext: Boolean(result.links.next) };
    } catch (error) {
      if (error instanceof GitHubApiError) throw mapGitHubError(error, "NOTIFICATIONS_UNAVAILABLE");
      throw error;
    }
  }

  async unreadCount(): Promise<number> {
    const result = await this.github.request({
      path: "/notifications",
      query: { all: "false", page: 1, per_page: 100 },
      schema: z.array(notificationSchema),
      endpointTemplate: "/notifications"
    });
    return result.data.filter((notification) => notification.unread).length;
  }

  async markRead(input: { ids?: string[]; all?: boolean }): Promise<{ updated: number }> {
    if (input.all) return this.markAllRead();
    const ids = input.ids ?? [];
    if (!ids.length) throw new AppError("VALIDATION_ERROR", "Provide notification ids or mark all as read.", 400, false, { ids: "Required" });
    if (ids.length > 50) throw new AppError("VALIDATION_ERROR", "At most 50 notifications can be marked at once.", 400, false, { ids: "Too many ids" });
    let updated = 0;
    for (const rawId of ids) {
      const id = rawId.trim();
      if (!/^\d+$/.test(id)) throw new AppError("VALIDATION_ERROR", "Notification identifiers must be numeric.", 400, false, { ids: "Invalid identifier" });
      try {
        await this.github.request({ method: "PUT", path: `/notifications/threads/${id}`, schema: z.unknown(), endpointTemplate: "/notifications/threads/{id}" });
        updated += 1;
      } catch (error) {
        if (error instanceof GitHubApiError) throw mapGitHubError(error, "NOTIFICATIONS_UNAVAILABLE");
        throw error;
      }
    }
    return { updated };
  }

  private async markAllRead(): Promise<{ updated: number }> {
    try {
      const updated = await this.unreadCount();
      await this.github.request({ method: "PUT", path: "/notifications", body: { last_read_at: new Date().toISOString() }, schema: z.unknown(), endpointTemplate: "/notifications" });
      return { updated };
    } catch (error) {
      if (error instanceof GitHubApiError) throw mapGitHubError(error, "NOTIFICATIONS_UNAVAILABLE");
      throw error;
    }
  }
}

function toNotification(notification: z.infer<typeof notificationSchema>): NotificationDto {
  return {
    id: notification.id,
    unread: notification.unread,
    reason: notification.reason,
    updatedAt: notification.updated_at,
    title: notification.subject.title,
    type: notification.subject.type,
    url: toGitHubHtmlUrl(notification.subject.html_url ?? notification.subject.url ?? notification.subject.latest_comment_url),
    repository: notification.repository ? {
      fullName: notification.repository.full_name,
      owner: notification.repository.owner.login,
      name: notification.repository.name,
      avatarUrl: notification.repository.owner.avatar_url ?? null
    } : null
  };
}

function toGitHubHtmlUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("https://api.github.com/")) return value;
  return value
    .replace("https://api.github.com/repos/", "https://github.com/")
    .replace(/\/pulls\/(\d+)$/, "/pull/$1");
}
