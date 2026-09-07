import { ActivityFeed } from "@/features/activity-feed/activity-feed";
import { ErrorState } from "@/components/feedback/states";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { ActivityService } from "@/server/services/activity-service";
import Link from "next/link";

const filters = ["all", "PushEvent", "PullRequestEvent", "IssuesEvent", "ReleaseEvent", "CreateEvent", "ForkEvent", "WatchEvent"] as const;

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ type?: string; page?: string }> }) {
  const { owner, repo } = await params;
  const query = await searchParams;
  const type = filters.includes(query.type as (typeof filters)[number]) ? query.type ?? "all" : "all";
  const page = Math.max(1, Number(query.page) || 1);
  let data: Awaited<ReturnType<ActivityService["list"]>> | null = null;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new ActivityService(new GitHubClient(accessToken, crypto.randomUUID())).list(owner, repo, page, 100, type);
  } catch { return <ErrorState message="Activity could not be loaded from GitHub."/>; }
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/activity`;
  return <section><header className="section-heading"><div><h2>Repository activity</h2><p>Recent events reported by GitHub, sorted newest first.</p></div></header><nav className="filter-chips" aria-label="Filter activity type">{filters.map((filter) => <Link key={filter} href={`${base}?type=${filter}`} aria-current={type === filter ? "page" : undefined}>{filter === "all" ? "All" : filter.replace("Event", "")}</Link>)}</nav><ActivityFeed activities={data.activities}/>{data.hasNext ? <div className="pagination"><span/><Link className="button button-secondary" href={`${base}?type=${type}&page=${page + 1}`}>Load more</Link></div> : null}</section>;
}
