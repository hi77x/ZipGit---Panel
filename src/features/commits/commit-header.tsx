import Image from "next/image";
import Link from "next/link";
import { UserRound } from "lucide-react";
import type { CommitDto } from "@/shared/contracts/content";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";

export function CommitHeader({ commit, owner, repo }: { commit: CommitDto; owner: string; repo: string }) {
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`;
  return <section className="panel">
    <div className="panel-body stack-sm">
      <div className="cluster">
        {commit.authorAvatar ? <Image className="avatar avatar-lg" src={commit.authorAvatar} alt="" width={46} height={46}/> : <UserRound aria-hidden="true"/>}
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{commit.message || "(no commit message)"}</h2>
          <p className="muted text-xs" style={{ margin: "4px 0 0" }}>
            <strong>{commit.authorName}</strong>
            {commit.authorLogin ? <span> · @{commit.authorLogin}</span> : null}
            <span> · <time dateTime={commit.authoredAt ?? undefined} title={formatDateTime(commit.authoredAt)}>{relativeTime(commit.authoredAt)}</time></span>
            <span> · {formatDateTime(commit.authoredAt)}</span>
          </p>
        </div>
      </div>
      <div className="cluster">
        <span className="commit-sha" title={commit.sha}>{commit.sha.slice(0, 7)}</span>
        <span className="diff-stats"><span className="diff-add-count">+{formatNumber(commit.additions)}</span><span className="diff-del-count">−{formatNumber(commit.deletions)}</span></span>
        {commit.parents.map((parent, index) => <Link className="commit-sha" key={parent} href={`${base}/${parent}`} title={parent}>{commit.parents.length > 1 ? `Parent ${index + 1}` : "Parent"} {parent.slice(0, 7)}</Link>)}
      </div>
    </div>
  </section>;
}
