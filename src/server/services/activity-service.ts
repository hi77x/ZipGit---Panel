import "server-only";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "./repository-service";
import { encodeGitHubSegment } from "@/lib/url";

const eventSchema = z.object({
  id: z.string(), type: z.string(), created_at: z.string(),
  actor: z.object({ login: z.string(), avatar_url: z.string().nullable().optional() }).partial().nullable(),
  payload: z.record(z.string(), z.unknown()).default({})
});

export type ActivityItem = ReturnType<typeof normalizeActivityEvent>;

export class ActivityService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async list(owner: string, repo: string, page: number, perPage: number, type = "all") {
    await this.repositories.assertAccessible(owner, repo);
    const result = await this.github.request({
      path: `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/events`,
      query: { page, per_page: Math.min(100, perPage) }, schema: z.array(eventSchema), endpointTemplate: "/repos/{owner}/{repo}/events"
    });
    const normalized = result.data.map(normalizeActivityEvent).filter((item) => type === "all" || item.type === type);
    return { activities: normalized, page, hasNext: Boolean(result.links.next) };
  }
}

export function normalizeActivityEvent(event: z.infer<typeof eventSchema>) {
  const payload = event.payload;
  const action = typeof payload.action === "string" ? payload.action : null;
  let summary = event.type.replace(/Event$/, " event");
  if (event.type === "PushEvent") {
    const count = Array.isArray(payload.commits) ? payload.commits.length : 0;
    const ref = typeof payload.ref === "string" ? payload.ref.replace("refs/heads/", "") : "a branch";
    summary = `pushed ${count} commit${count === 1 ? "" : "s"} to ${ref}`;
  } else if (event.type === "PullRequestEvent") {
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    summary = `${action ?? "updated"} pull request #${typeof payload.number === "number" ? payload.number : "?"}${typeof pr?.title === "string" ? `: ${pr.title}` : ""}`;
  } else if (event.type === "IssuesEvent") {
    const issue = payload.issue as Record<string, unknown> | undefined;
    summary = `${action ?? "updated"} issue #${typeof issue?.number === "number" ? issue.number : "?"}${typeof issue?.title === "string" ? `: ${issue.title}` : ""}`;
  } else if (event.type === "CreateEvent" || event.type === "DeleteEvent") {
    summary = `${event.type === "CreateEvent" ? "created" : "deleted"} ${String(payload.ref_type ?? "ref")} ${String(payload.ref ?? "")}`.trim();
  } else if (event.type === "ReleaseEvent") summary = `${action ?? "updated"} a release`;
  else if (event.type === "ForkEvent") summary = "forked the repository";
  else if (event.type === "WatchEvent") summary = "starred the repository";
  const hours = Math.round((new Date(event.created_at).getTime() - Date.now()) / 3_600_000);
  const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(hours, "hour");
  return { id: event.id, type: event.type, actor: event.actor?.login ?? "GitHub user", avatarUrl: event.actor?.avatar_url ?? null, createdAt: event.created_at, summary, relativeTime };
}
