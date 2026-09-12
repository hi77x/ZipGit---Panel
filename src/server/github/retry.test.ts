import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { GitHubFaultServer } from "@/test/github-fault-server";
import { GitHubClient, isRetryableGitHubFailure, retryDelayMs } from "./client";
import { GitHubApiError } from "./errors";

const servers: GitHubFaultServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

async function setup() {
  const server = new GitHubFaultServer();
  servers.push(server);
  const baseUrl = await server.start();
  return { server, client: new GitHubClient("test-token", "retry-test", { baseUrl }) };
}

const userSchema = z.object({ login: z.string() });

function apiError(status: number, retryAfter: number | null = null): GitHubApiError {
  return new GitHubApiError({ status, message: "upstream", remaining: null, resetAt: null, retryAfter, githubRequestId: null, fields: [] });
}

describe("GitHub retry policy", () => {
  it("retries only network, rate-limit, and server failures", () => {
    expect(isRetryableGitHubFailure(apiError(0))).toBe(true);
    expect(isRetryableGitHubFailure(apiError(429))).toBe(true);
    expect(isRetryableGitHubFailure(apiError(403, 5))).toBe(true);
    expect(isRetryableGitHubFailure(apiError(502))).toBe(true);
    expect(isRetryableGitHubFailure(apiError(503))).toBe(true);
    expect(isRetryableGitHubFailure(apiError(403))).toBe(false);
    expect(isRetryableGitHubFailure(apiError(404))).toBe(false);
    expect(isRetryableGitHubFailure(apiError(422))).toBe(false);
    expect(isRetryableGitHubFailure(apiError(-2))).toBe(false);
  });

  it("keeps backoff jitter bounded and honors Retry-After within a cap", () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const delay = retryDelayMs(new Error("network"), attempt);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(5_000);
    }
    expect(retryDelayMs(apiError(429, 2), 0)).toBe(2_000);
    expect(retryDelayMs(apiError(429, 45), 0)).toBe(30_000);
  });

  it("retries a failed GET once and succeeds", async () => {
    const { server, client } = await setup();
    server.addRule({ method: "GET", path: "/user", status: 503, times: 1 });
    const result = await client.request({ path: "/user", schema: userSchema });
    expect(result.data.login).toBe("octo");
    expect(client.lastRetryCount).toBe(1);
    expect(server.state.requests.filter((request) => request === "GET /user")).toHaveLength(2);
  });

  it("honors Retry-After on a primary rate limit", async () => {
    const { server, client } = await setup();
    server.addRule({ method: "GET", path: "/user", status: 429, times: 1, headers: { "retry-after": "0" }, body: { message: "API rate limit exceeded" } });
    await expect(client.request({ path: "/user", schema: userSchema })).resolves.toMatchObject({ data: { login: "octo" } });
    expect(server.state.requests.filter((request) => request === "GET /user")).toHaveLength(2);
  });

  it("never retries mutations because they may have been applied upstream", async () => {
    const { server, client } = await setup();
    server.addRule({ method: "POST", path: "/user/repos", status: 503, times: 5 });
    await expect(client.request({ method: "POST", path: "/user/repos", body: { name: "x" }, schema: z.unknown() })).rejects.toMatchObject({ details: { status: 503 } });
    expect(server.state.requests.filter((request) => request === "POST /user/repos")).toHaveLength(1);
    expect(client.lastRetryCount).toBe(0);
  });

  it("classifies malformed payloads distinctly and does not retry them", async () => {
    const { server, client } = await setup();
    server.addRule({ method: "GET", path: "/user", status: 200, text: "not-json", times: 3 });
    await expect(client.request({ path: "/user", schema: userSchema })).rejects.toMatchObject({ details: { status: -2 } });
    expect(server.state.requests.filter((request) => request === "GET /user")).toHaveLength(1);
  });

  it("propagates external aborts without turning them into retries", async () => {
    const { server, client } = await setup();
    server.addRule({ method: "GET", path: "/user", status: 200, delayMs: 5_000, times: 1 });
    const controller = new AbortController();
    const pending = client.request({ path: "/user", schema: userSchema, signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 50));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "GitHubApiError" });
    expect(server.state.requests.filter((request) => request === "GET /user")).toHaveLength(1);
  });
});
