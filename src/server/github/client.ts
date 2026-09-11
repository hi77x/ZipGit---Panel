import "server-only";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { GitHubApiError } from "./errors";
import { parseLinkHeader } from "./pagination";

export type GitHubRateLimit = { limit: number | null; remaining: number | null; resetAt: string | null };
export type GitHubResult<T> = { data: T; rateLimit: GitHubRateLimit; links: Record<string, string> };
type RequestOptions<T> = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  endpointTemplate?: string;
  accept?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GitHubClient {
  public lastRateLimit: GitHubRateLimit | null = null;

  constructor(private readonly accessToken: string, private readonly requestId: string) {}

  async request<T>(options: RequestOptions<T>): Promise<GitHubResult<T>> {
    if (!options.path.startsWith("/") || options.path.startsWith("//") || /^https?:/i.test(options.path)) {
      throw new Error("GitHubClient only accepts relative API paths");
    }
    const method = options.method ?? "GET";
    const attempts = method === "GET" ? 3 : 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.execute(options, method);
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        lastError = error;
        const status = error instanceof GitHubApiError ? error.details.status : 0;
        if (attempt === attempts - 1 || (status > 0 && status < 500)) throw error;
        await sleep(150 * 2 ** attempt + Math.floor(Math.random() * 100));
      }
    }
    throw lastError;
  }

  private async execute<T>(options: RequestOptions<T>, method: NonNullable<RequestOptions<T>["method"]>): Promise<GitHubResult<T>> {
    const env = getServerEnv();
    const url = new URL(options.path, env.GITHUB_API_BASE_URL);
    for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined) url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    const started = performance.now();
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: options.accept ?? "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": env.GITHUB_API_VERSION,
          "User-Agent": "RepoDeck"
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        signal: controller.signal
      });
      const rateLimit = readRateLimit(response.headers);
      this.lastRateLimit = rateLimit;
      const githubRequestId = response.headers.get("x-github-request-id");
      log("info", {
        requestId: this.requestId, service: "github", operation: method,
        githubEndpointTemplate: options.endpointTemplate ?? options.path, githubStatus: response.status,
        githubRequestId, durationMs: Math.round(performance.now() - started)
      });
      const text = response.status === 204 ? "" : await response.text();
      if (!response.ok) throw new GitHubApiError(parseError(response, text, rateLimit));
      let value: unknown = null;
      if (text) {
        try { value = JSON.parse(text); } catch { value = text; }
      }
      return { data: options.schema.parse(value), rateLimit, links: parseLinkHeader(response.headers.get("link")) };
    } catch (error) {
      if (error instanceof GitHubApiError) throw error;
      if (error instanceof z.ZodError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new GitHubApiError({ status: 0, message: "GitHub request timed out", remaining: null, resetAt: null, retryAfter: null, githubRequestId: null, fields: [] });
      }
      throw new GitHubApiError({ status: 0, message: "GitHub network request failed", remaining: null, resetAt: null, retryAfter: null, githubRequestId: null, fields: [] });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function readRateLimit(headers: Headers): GitHubRateLimit {
  const reset = Number(headers.get("x-ratelimit-reset"));
  return {
    limit: numericHeader(headers, "x-ratelimit-limit"),
    remaining: numericHeader(headers, "x-ratelimit-remaining"),
    resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null
  };
}

function numericHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseError(response: Response, text: string, rate: GitHubRateLimit) {
  let body: { message?: string; errors?: Array<{ resource?: string; field?: string; code?: string }> } = {};
  try { body = JSON.parse(text) as typeof body; } catch { /* intentionally ignore non-JSON upstream error */ }
  return {
    status: response.status,
    message: body.message ?? response.statusText,
    remaining: rate.remaining,
    resetAt: rate.resetAt,
    retryAfter: numericHeader(response.headers, "retry-after"),
    githubRequestId: response.headers.get("x-github-request-id"),
    fields: Array.isArray(body.errors) ? body.errors.map(({ resource, field, code }) => ({ resource, field, code })) : []
  };
}
