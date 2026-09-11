"use client";
import { Fragment, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import type { CommitRefDto } from "@/shared/contracts/content";
import { formatDate, relativeTime } from "@/lib/format";

export function CommitList({ commits, owner, repo }: { commits: CommitRefDto[]; owner: string; repo: string }) {
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`;
  return <div className="commit-list">
    {commits.map((commit, index) => {
      const day = commit.authoredAt ? commit.authoredAt.slice(0, 10) : null;
      const previousDay = index > 0 ? commits[index - 1]?.authoredAt?.slice(0, 10) ?? null : null;
      return <Fragment key={commit.sha}>
        {day && day !== previousDay ? <div className="commit-group-label" suppressHydrationWarning>{formatDate(commit.authoredAt)}</div> : null}
        <article className="commit-row">
          <div className="commit-main">
            <Link className="commit-msg" href={`${base}/${commit.sha}`}>{commit.message || "(no commit message)"}</Link>
            <div className="commit-meta">
              {commit.authorAvatar ? <Image className="commit-avatar" src={commit.authorAvatar} alt="" width={22} height={22}/> : null}
              <span>{commit.authorName}</span>
              <span>committed <time dateTime={commit.authoredAt ?? undefined} suppressHydrationWarning>{relativeTime(commit.authoredAt)}</time></span>
              <Link className="commit-sha" href={`${base}/${commit.sha}`} title={commit.sha}>{commit.sha.slice(0, 7)}</Link>
            </div>
          </div>
          <div className="commit-actions">
            <CopyButton value={commit.sha}/>
          </div>
        </article>
      </Fragment>;
    })}
  </div>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return <button type="button" className="button button-ghost button-icon button-sm" onClick={() => { void copy(); }} aria-label={copied ? "Commit SHA copied" : "Copy commit SHA"} title={copied ? "Copied" : "Copy commit SHA"}>
    {copied ? <Check aria-hidden="true"/> : <Copy aria-hidden="true"/>}
  </button>;
}
