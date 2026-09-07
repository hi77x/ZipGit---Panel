import { Activity, GitCommitHorizontal } from "lucide-react";
import Image from "next/image";
import { EmptyState } from "@/components/feedback/states";
import type { ActivityItem } from "@/server/services/activity-service";

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (!activities.length) return <EmptyState title="No recent activity" message="GitHub Events has a limited public history window, and no recent events are available."/>;
  return <div className="activity-feed">{activities.map((item, index) => {
    const nextDay = new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: "long" });
    const previousDay = index > 0 ? new Date(activities[index - 1]?.createdAt ?? "").toLocaleDateString(undefined, { dateStyle: "long" }) : null;
    return <div key={item.id}>{nextDay !== previousDay ? <h2>{nextDay}</h2> : null}<article className="activity-row">{item.avatarUrl ? <Image src={item.avatarUrl} alt="" width={38} height={38}/> : <Activity/>}<GitCommitHorizontal className="activity-icon" aria-hidden="true"/><div><p><strong>{item.actor}</strong> {item.summary}</p><time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>{item.relativeTime}</time></div></article></div>;
  })}</div>;
}
