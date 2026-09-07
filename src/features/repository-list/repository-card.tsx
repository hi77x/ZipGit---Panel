import Link from "next/link";
import Image from "next/image";
import { GitFork, LockKeyhole, Star } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import type { RepositoryDto } from "@/shared/contracts/repository";

export function RepositoryCard({ repository }: { repository: RepositoryDto }) {
  return <Card className="repo-card">
    <div className="repo-card-head"><Image src={repository.avatarUrl} alt="" width={38} height={38}/><div><Link title={repository.fullName} href={`/repositories/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`}>{repository.name}</Link><span>{repository.owner}</span></div><Badge tone={repository.visibility === "private" ? "warning" : "neutral"}>{repository.visibility === "private" ? <LockKeyhole/> : null}{repository.visibility}</Badge></div>
    <p>{repository.description || "No description provided."}</p>
    <div className="repo-meta"><span>{repository.language ?? "—"}</span><span><Star/> {repository.stars}</span><span><GitFork/> {repository.forks}</span><time dateTime={repository.updatedAt}>{new Date(repository.updatedAt).toLocaleDateString()}</time></div>
  </Card>;
}
