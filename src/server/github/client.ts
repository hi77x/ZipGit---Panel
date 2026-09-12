import "server-only";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { counter, histogram, withSpan } from "@/server/observability/telemetry";
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
  signal?: AbortSignal;
};

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 250;
const RETRY_MAX_DELAY_MS = 5_000;
const RETRY_MAX_AFTER_MS = 30_000;
const SCHEMA_MISMATCH_STATUS = -2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isRetryableGitHubFailure(error: unknown): boolean {
  if (!(error instanceof GitHubApiError)) return false;
  const { status, retryAfter } = error.details;
  if (status === 0) return true;
  if (status === 429) return true;
  if (status === 403 && retryAfter !== null) return true;
  return status >= 500 && status <= 599;
}

function retryDelayMs(error: unknown, attempt: number): number {
  if (error instanceof GitHubApiError && error.details.retryAfter !== null) {
    return Math.min(RETRY_MAX_AFTER_MS, Math.max(0, error.details.retryAfter * 1000));
  }
  const ceiling = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_MS * 2 ** attempt);
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

export { retryDelayMs };

export class GitHubClient {
  public lastRateLimit: GitHubRateLimit | null = null;
  public lastRetryCount = 0;

  constructor(private readonly accessToken: string, private readonly requestId: string, private readonly options: { baseUrl?: string } = {}) {}

  async request<T>(options: RequestOptions<T>): Promise<GitHubResult<T>> {
    if (!options.path.startsWith("/") || options.path.startsWith("//") || /^https?:/i.test(options.path)) {
      throw new Error("GitHubClient only accepts relative API paths");
    }
    const method = options.method ?? "GET";
    const attempts = method === "GET" ? RETRY_ATTEMPTS : 1;
    this.lastRetryCount = 0;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.execute(options, method);
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        lastError = error;
        const retryable = isRetryableGitHubFailure(error);
        if (attempt === attempts - 1 || !retryable || options.signal?.aborted) throw error;
        this.lastRetryCount = attempt + 1;
        const delay = retryDelayMs(error, attempt);
        counter("repodeck.github.retries", "GitHub retry attempts").add(1, { endpoint: options.endpointTemplate ?? "github.unknown", status: error instanceof GitHubApiError ? String(error.details.status) : "network" });
        log("warn", { requestId: this.requestId, service: "github", event: "github_retry", githubEndpointTemplate: options.endpointTemplate ?? options.path, attempt: attempt + 1, delayMs: delay, githubStatus: error instanceof GitHubApiError ? error.details.status : 0 });
        await sleep(delay);
      }
    }
    throw lastError;
  }

  private async execute<T>(options: RequestOptions<T>, method: NonNullable<RequestOptions<T>["method"]>): Promise<GitHubResult<T>> {
    const endpoint = options.endpointTemplate ?? "github.unknown";
    return withSpan("github.request", { method, endpoint, requestId: this.requestId }, async () => {
      const started = performance.now();
      try {
        return await this.executeFetch(options, method);
      } finally {
        histogram("repodeck.github.request.duration", "GitHub request duration").record(Math.round(performance.now() - started), { method, endpoint });
      }
    });
  }

  private async executeFetch<T>(options: RequestOptions<T>, method: NonNullable<RequestOptions<T>["method"]>): Promise<GitHubResult<T>> {
    const env = getServerEnv();
    const url = new URL(options.path, this.options.baseUrl ?? env.GITHUB_API_BASE_URL);
    for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined) url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });
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
      const endpoint = options.endpointTemplate ?? "github.unknown";
      counter("repodeck.github.requests", "GitHub API requests").add(1, { method, endpoint, status: response.status >= 500 ? "5xx" : response.status >= 400 ? String(response.status) : "ok" });
      log("info", {
        requestId: this.requestId, service: "github", operation: method,
        githubEndpointTemplate: options.endpointTemplate ?? options.path, githubStatus: response.status,
        githubRequestId, durationMs: Math.round(performance.now() - started), retryCount: this.lastRetryCount
      });
      const text = response.status === 204 ? "" : await response.text();
      if (!response.ok) throw new GitHubApiError(parseError(response, text, rateLimit));
      let value: unknown = null;
      if (text) {
        try { value = JSON.parse(text); } catch { value = text; }
      }
      try {
        return { data: options.schema.parse(value), rateLimit, links: parseLinkHeader(response.headers.get("link")) };
      } catch (schemaError) {
        log("error", { requestId: this.requestId, service: "github", event: "github_schema_mismatch", githubEndpointTemplate: options.endpointTemplate ?? options.path, errorName: schemaError instanceof Error ? schemaError.name : "Unknown" });
        throw new GitHubApiError({ status: SCHEMA_MISMATCH_STATUS, message: "GitHub returned an unexpected response shape", remaining: rateLimit.remaining, resetAt: rateLimit.resetAt, retryAfter: null, githubRequestId, fields: [] });
      }
    } catch (error) {
      if (error instanceof GitHubApiError) throw error;
      if (error instanceof z.ZodError) throw error;
      const aborted = controller.signal.aborted;
      const externalAbort = Boolean(options.signal?.aborted);
      counter("repodeck.github.requests", "GitHub API requests").add(1, { method, endpoint: options.endpointTemplate ?? "github.unknown", status: "network" });
      log("warn", { requestId: this.requestId, service: "github", event: aborted ? "github_aborted" : "github_network_error", githubEndpointTemplate: options.endpointTemplate ?? options.path, externalAbort, durationMs: Math.round(performance.now() - started) });
      if (error instanceof Error && error.name === "AbortError" && !externalAbort) {
        throw new GitHubApiError({ status: 0, message: "GitHub request timed out", remaining: null, resetAt: null, retryAfter: null, githubRequestId: null, fields: [] });
      }
      throw new GitHubApiError({ status: 0, message: "GitHub network request failed", remaining: null, resetAt: null, retryAfter: null, githubRequestId: null, fields: [] });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onExternalAbort);
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
  try { body = JSON.parse(text) as typeof body; } catch { /* upstream body was not JSON */ }
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
