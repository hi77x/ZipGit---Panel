import "server-only";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";
import { encodeGitHubSegment, isSafeGitHubRef } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";

const readmeMetaSchema = z.object({ path: z.string(), name: z.string(), sha: z.string(), content: z.string().optional(), encoding: z.string().optional(), html_url: z.url() });
const markdownHtmlSchema = z.string();
const allowedImageHosts = new Set(["avatars.githubusercontent.com", "raw.githubusercontent.com", "github.com", "user-images.githubusercontent.com", "camo.githubusercontent.com"]);

export class ReadmeService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async get(owner: string, repo: string, ref: string) {
    if (!isSafeGitHubRef(ref)) throw new AppError("VALIDATION_ERROR", "Invalid Git reference.", 400);
    await this.repositories.assertAccessible(owner, repo);
    const encodedOwner = encodeGitHubSegment(owner);
    const encodedRepo = encodeGitHubSegment(repo);
    try {
      const metadata = await this.github.request({
        path: `/repos/${encodedOwner}/${encodedRepo}/readme`, query: { ref }, schema: readmeMetaSchema,
        endpointTemplate: "/repos/{owner}/{repo}/readme"
      });
      const raw = await this.github.request({
        path: `/repos/${encodedOwner}/${encodedRepo}/readme`, query: { ref }, schema: z.string(),
        accept: "application/vnd.github.raw+json", endpointTemplate: "/repos/{owner}/{repo}/readme"
      });
      if (Buffer.byteLength(raw.data, "utf8") > 1024 * 1024) {
        return { exists: true as const, html: "<p>This README is larger than the 1 MiB rendering limit. Open the source on GitHub to view it safely.</p>", fallbackMarkdown: null, path: metadata.data.path, name: metadata.data.name, sha: metadata.data.sha, sourceUrl: metadata.data.html_url, owner, repo, ref };
      }
      const rendered = await this.render(owner, repo, ref, metadata.data.path, raw.data);
      return { exists: true as const, ...rendered, path: metadata.data.path, name: metadata.data.name, sha: metadata.data.sha, sourceUrl: metadata.data.html_url, owner, repo, ref };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) return { exists: false as const, html: "", path: null, name: null, sha: null, sourceUrl: null };
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    }
  }

  private async render(owner: string, repo: string, ref: string, path: string, markdown: string): Promise<{ html: string; fallbackMarkdown: string | null }> {
    try {
      const rendered = (await this.github.request({
        method: "POST", path: "/markdown", body: { mode: "gfm", context: `${owner}/${repo}`, text: markdown },
        schema: markdownHtmlSchema, endpointTemplate: "/markdown", accept: "text/html"
      })).data;
      return { html: sanitizeReadmeHtml(rendered, { owner, repo, ref, readmePath: path }), fallbackMarkdown: null };
    } catch {
      return { html: "", fallbackMarkdown: markdown };
    }
  }
}

export function sanitizeReadmeHtml(html: string, context: { owner: string; repo: string; ref: string; readmePath: string }): string {
  return sanitizeHtml(html, {
    allowedTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "img", "ul", "ol", "li", "blockquote", "pre", "code", "table", "thead", "tbody", "tr", "th", "td", "hr", "br", "strong", "em", "del", "details", "summary", "kbd", "input", "span", "div"],
    allowedAttributes: {
      a: ["href", "title", "id", "class", "target", "rel"], img: ["src", "alt", "title", "width", "height"],
      input: ["checked", "disabled", "type"], "*": ["id", "class", "align"]
    },
    allowedClasses: { "*": [/^[-\w ]+$/] },
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: (_tag, attrs) => ({ tagName: "a", attribs: transformLink(attrs, context) }),
      img: (_tag, attrs) => ({ tagName: "img", attribs: transformImage(attrs, context) }),
      input: (_tag, attrs) => ({ tagName: "input", attribs: { ...attrs, disabled: "disabled" } })
    },
    exclusiveFilter: (frame) => (frame.tag === "a" && !frame.attribs.href) || (frame.tag === "img" && !frame.attribs.src)
  });
}

function transformLink(attrs: Record<string, string>, context: { owner: string; repo: string; ref: string; readmePath: string }) {
  const href = attrs.href;
  if (!href) return { ...attrs, href: "" };
  if (href.startsWith("#")) return attrs;
  const resolved = resolveReadmeUrl(href, context, false);
  return resolved ? { ...attrs, href: resolved, target: "_blank", rel: "noopener noreferrer" } : { ...attrs, href: "" };
}

function transformImage(attrs: Record<string, string>, context: { owner: string; repo: string; ref: string; readmePath: string }) {
  const src = attrs.src ? resolveReadmeUrl(attrs.src, context, true) : null;
  return src ? { ...attrs, src } : { ...attrs, src: "" };
}

export function resolveReadmeUrl(value: string, context: { owner: string; repo: string; ref: string; readmePath: string }, image: boolean): string | null {
  if (/^(javascript|data|vbscript):/i.test(value) || value.startsWith("//")) return null;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    return !image || allowedImageHosts.has(url.hostname) ? url.toString() : null;
  }
  const directory = context.readmePath.includes("/") ? context.readmePath.slice(0, context.readmePath.lastIndexOf("/") + 1) : "";
  const normalized = new URL(value, `https://local.invalid/${directory}`).pathname.replace(/^\//, "");
  const owner = encodeURIComponent(context.owner), repo = encodeURIComponent(context.repo), ref = encodeURIComponent(context.ref);
  return image
    ? `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${normalized}`
    : `https://github.com/${owner}/${repo}/blob/${ref}/${normalized}`;
}
