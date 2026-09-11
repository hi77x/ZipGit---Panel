import Link from "next/link";
import Image from "next/image";
import { GitFork, LockKeyhole, Star } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { languageColor } from "@/lib/language";
import { relativeTime } from "@/lib/format";
import type { RepositoryDto } from "@/shared/contracts/repository";

export function RepositoryCard({ repository }: { repository: RepositoryDto }) {
  return <Card className="repo-card card-hover">
    <div className="repo-card-head"><Image src={repository.avatarUrl} alt="" width={34} height={34}/><div><Link title={repository.fullName} href={`/repositories/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`}>{repository.name}</Link><span>{repository.owner}</span></div><Badge tone={repository.visibility === "private" ? "warning" : "neutral"}>{repository.visibility === "private" ? <LockKeyhole/> : null}{repository.visibility}</Badge></div>
    <p>{repository.description || "No description provided."}</p>
    <div className="repo-meta">
      {repository.language ? <span><span className="language-dot" style={{ background: languageColor(repository.language) }}/>{repository.language}</span> : <span>—</span>}
      <span><Star/> {repository.stars}</span>
      <span><GitFork/> {repository.forks}</span>
      <time dateTime={repository.pushedAt ?? repository.updatedAt}>pushed {relativeTime(repository.pushedAt ?? repository.updatedAt)}</time>
    </div>
  </Card>;
}
