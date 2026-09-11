"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { NotificationDto } from "@/shared/contracts/misc";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent" | "info";

export function NotificationInbox({ notifications, unreadCount }: { notifications: NotificationDto[]; unreadCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  async function markRead(ids: string[] | undefined, all = false) {
    setPending(all ? "all" : ids?.[0] ?? null);
    try {
      await apiRequest<{ updated: number }>("/api/github/notifications/read", { method: "POST", body: JSON.stringify(all ? { all: true } : { ids }) });
      toast(all ? "All notifications marked as read." : "Notification marked as read.", "success");
      router.refresh();
    } catch (unknownError) {
      toast(unknownError instanceof Error ? unknownError.message : "Notifications could not be updated.", "error");
    } finally {
      setPending(null);
    }
  }

  return <div className="feature-stack">
    <div className="spread">
      <span className="muted text-sm">{unreadCount ? `${unreadCount} unread` : "No unread notifications"}</span>
      <Button type="button" loading={pending === "all"} disabled={unreadCount === 0} onClick={() => void markRead(undefined, true)}><CheckCheck/>Mark all as read</Button>
    </div>
    <div className="inbox">
      {notifications.map((notification) => <article key={notification.id} className={`inbox-row${notification.unread ? " unread" : ""}`}>
        <span className="unread-dot" aria-hidden="true" style={notification.unread ? undefined : { visibility: "hidden" }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <div className="inbox-title">
              {notification.url ? <a href={notification.url} target="_blank" rel="noopener noreferrer">{notification.title}</a> : notification.title}
            </div>
            <Badge tone={reasonTone(notification.reason)}>{notification.reason.replace(/_/g, " ")}</Badge>
          </div>
          <div className="inbox-meta">
            {notification.repository ? <Link href={`/repositories/${encodeURIComponent(notification.repository.owner)}/${encodeURIComponent(notification.repository.name)}`}>{notification.repository.fullName}</Link> : <span>Other activity</span>}
            <span>{notification.type.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
            <time dateTime={notification.updatedAt} title={formatDateTime(notification.updatedAt)}>{relativeTime(notification.updatedAt)}</time>
          </div>
        </div>
        <div className="row-actions">
          {notification.repository?.avatarUrl ? <Image className="avatar avatar-sm" src={notification.repository.avatarUrl} alt="" width={24} height={24}/> : null}
          {notification.unread ? <Button type="button" size="sm" loading={pending === notification.id} onClick={() => void markRead([notification.id])}><Check/>Mark read</Button> : null}
          {notification.url ? <a className="button button-sm" href={notification.url} target="_blank" rel="noopener noreferrer"><ExternalLink/>Open</a> : null}
        </div>
      </article>)}
    </div>
  </div>;
}

function reasonTone(reason: string): Tone {
  if (reason === "review_requested" || reason === "mention") return "info";
  if (reason === "state_change" || reason === "security_alert") return "danger";
  if (reason === "assign" || reason === "author") return "success";
  if (reason === "subscribed" || reason === "team_mention" || reason === "comment") return "warning";
  return "neutral";
}
