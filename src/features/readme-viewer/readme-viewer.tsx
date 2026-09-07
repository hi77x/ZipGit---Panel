import { BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/states";

type ReadmeData = { exists: boolean; html: string; fallbackMarkdown?: string | null; sourceUrl: string | null; name: string | null; owner?: string; repo?: string; ref?: string; path?: string | null };

export function ReadmeViewer({ data }: { data: ReadmeData }) {
  if (!data.exists) return <Card><EmptyState title="No README found" message="The repository is available, but it does not have a README on this branch."/></Card>;
  return <Card className="readme-card"><header><span><BookOpen/> {data.name}</span>{data.sourceUrl ? <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">View source</a> : null}</header>{data.fallbackMarkdown ? <div className="markdown-body"><div className="inline-warning">GitHub rendering is temporarily unavailable; showing a safe local GFM rendering.</div><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children, ...props }) => <a {...props} href={fallbackUrl(href, data, false) ?? undefined} target="_blank" rel="noopener noreferrer">{children}</a>, img: ({ src, alt, ...props }) => { const safe = fallbackUrl(typeof src === "string" ? src : undefined, data, true); return safe ? <img {...props} src={safe} alt={alt ?? ""}/> : null; } }}>{data.fallbackMarkdown}</ReactMarkdown></div> : <div className="markdown-body" dangerouslySetInnerHTML={{ __html: data.html }}/>}</Card>;
}

const imageHosts = new Set(["avatars.githubusercontent.com", "raw.githubusercontent.com", "github.com", "user-images.githubusercontent.com", "camo.githubusercontent.com"]);
function fallbackUrl(value: string | undefined, data: ReadmeData, image: boolean): string | null {
  if (!value || /^(javascript|data|vbscript):/i.test(value) || value.startsWith("//")) return null;
  if (value.startsWith("#") && !image) return value;
  if (/^https?:\/\//i.test(value)) { const url = new URL(value); return !image || imageHosts.has(url.hostname) ? url.toString() : null; }
  if (!data.owner || !data.repo || !data.ref) return null;
  const directory = data.path?.includes("/") ? data.path.slice(0, data.path.lastIndexOf("/") + 1) : "";
  const path = new URL(value, `https://local.invalid/${directory}`).pathname.replace(/^\//, "");
  return image ? `https://raw.githubusercontent.com/${encodeURIComponent(data.owner)}/${encodeURIComponent(data.repo)}/${encodeURIComponent(data.ref)}/${path}` : `https://github.com/${encodeURIComponent(data.owner)}/${encodeURIComponent(data.repo)}/blob/${encodeURIComponent(data.ref)}/${path}`;
}
