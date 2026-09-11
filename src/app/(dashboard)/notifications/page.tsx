import { Bell } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { NotificationInbox } from "@/features/notifications/notification-inbox";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { NotificationService } from "@/server/services/notification-service";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  let data: Awaited<ReturnType<NotificationService["list"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new NotificationService(new GitHubClient(accessToken, crypto.randomUUID())).list({ all: true, page, perPage: 30 });
  } catch {
    return <div className="page"><ErrorState message="Notifications could not be loaded from GitHub."/></div>;
  }
  return <div className="page">
    <header className="page-header">
      <div><span className="eyebrow"><Bell/> Review queue</span><h1>Notifications</h1><p>Unread mentions, reviews, and assignments from repositories you watch on GitHub.</p></div>
    </header>
    {data.notifications.length ? <NotificationInbox notifications={data.notifications} unreadCount={data.unreadCount}/> : <EmptyState title="Inbox zero" message="There are no GitHub notifications for this account right now."/>}
    <nav className="pagination" aria-label="Notification pages">
      {page > 1 ? <ButtonLink href={`/notifications?page=${page - 1}`}>Previous</ButtonLink> : <span/>}
      {data.hasNext ? <ButtonLink href={`/notifications?page=${page + 1}`}>Next</ButtonLink> : null}
    </nav>
  </div>;
}
