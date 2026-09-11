import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type FaultRule = {
  method?: string;
  path: string | RegExp;
  status?: number;
  body?: unknown;
  text?: string;
  times?: number;
  delayMs?: number;
  drop?: boolean;
};

export type MockRepository = { owner: string; name: string; defaultBranch: string; refs: Map<string, string> };

export type GitHubFaultState = {
  repositories: Map<string, MockRepository>;
  blobCount: number;
  treeCount: number;
  commitCount: number;
  refCount: number;
  deletedRefs: string[];
  deletedRepositories: string[];
  requests: string[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GitHubFaultServer {
  readonly state: GitHubFaultState = {
    repositories: new Map(),
    blobCount: 0,
    treeCount: 0,
    commitCount: 0,
    refCount: 0,
    deletedRefs: [],
    deletedRepositories: [],
    requests: []
  };
  deletableRepositories = true;
  blobFailureAfter: number | null = null;
  accessToken = "test-token";
  private readonly rules: Array<FaultRule & { remaining: number }> = [];
  private server: Server | null = null;
  private baseUrl = "";

  addRule(rule: FaultRule): void {
    this.rules.push({ ...rule, remaining: rule.times ?? Number.POSITIVE_INFINITY });
  }

  async start(): Promise<string> {
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
    const address = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${address.port}`;
    return this.baseUrl;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => { this.server?.close(() => resolve()); });
    this.server = null;
  }

  private takeRule(method: string, path: string): (FaultRule & { remaining: number }) | null {
    for (const rule of this.rules) {
      if (rule.remaining <= 0) continue;
      if (rule.method && rule.method !== method) continue;
      const matches = typeof rule.path === "string" ? rule.path === path : rule.path.test(path);
      if (!matches) continue;
      rule.remaining -= 1;
      return rule;
    }
    return null;
  }

  private async handle(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const method = request.method ?? "GET";
    const path = url.pathname;
    this.state.requests.push(`${method} ${path}`);
    const rule = this.takeRule(method, path);
    if (rule) {
      if (rule.drop) { request.socket.destroy(); return; }
      if (rule.delayMs) await sleep(rule.delayMs);
      if (rule.status) { this.respond(response, rule.status, rule.body, rule.text); return; }
    }
    if (request.headers.authorization !== `Bearer ${this.accessToken}`) return this.respond(response, 401, { message: "Bad credentials" });

    if (method === "GET" && path === "/user") return this.respond(response, 200, { id: 1, login: "octo", name: "Octo Test", email: "octo@example.test", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" });
    if (method === "GET" && path === "/user/orgs") return this.respond(response, 200, []);

    const repositoryMatch = /^\/repos\/([^/]+)\/([^/]+)$/.exec(path);
    if (repositoryMatch && method === "GET") {
      const repository = this.find(repositoryMatch[1] ?? "", repositoryMatch[2] ?? "");
      if (!repository) return this.respond(response, 404, { message: "Not Found" });
      return this.respond(response, 200, { id: 1, name: repository.name, full_name: `${repository.owner}/${repository.name}`, private: true, visibility: "private", description: null, language: null, stargazers_count: 0, forks_count: 0, updated_at: new Date().toISOString(), default_branch: repository.defaultBranch, html_url: `https://github.com/${repository.owner}/${repository.name}`, owner: { login: repository.owner, avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" } });
    }
    if (repositoryMatch && method === "PATCH") {
      const repository = this.find(repositoryMatch[1] ?? "", repositoryMatch[2] ?? "");
      if (!repository) return this.respond(response, 404, { message: "Not Found" });
      const body = await this.readJson(request);
      if (typeof body.default_branch === "string") repository.defaultBranch = body.default_branch;
      return this.respond(response, 200, { default_branch: repository.defaultBranch });
    }
    if (repositoryMatch && method === "DELETE") {
      if (!this.deletableRepositories) return this.respond(response, 403, { message: "Must have admin rights to Repository." });
      const key = `${repositoryMatch[1]}/${repositoryMatch[2]}`;
      if (!this.state.repositories.has(key)) return this.respond(response, 404, { message: "Not Found" });
      this.state.repositories.delete(key);
      this.state.deletedRepositories.push(key);
      return this.respond(response, 204);
    }
    if (method === "POST" && path === "/user/repos") {
      const body = await this.readJson(request);
      const key = `octo/${String(body.name)}`;
      const repository: MockRepository = { owner: "octo", name: String(body.name), defaultBranch: "main", refs: new Map() };
      this.state.repositories.set(key, repository);
      return this.respond(response, 201, { full_name: key, html_url: `https://github.com/${key}`, name: repository.name, owner: { login: repository.owner } });
    }

    const blobMatch = /^\/repos\/([^/]+)\/([^/]+)\/git\/blobs$/.exec(path);
    if (blobMatch && method === "POST") {
      this.state.blobCount += 1;
      if (this.blobFailureAfter !== null && this.state.blobCount > this.blobFailureAfter) return this.respond(response, 500, { message: "Injected blob failure" });
      return this.respond(response, 201, { sha: `blob-sha-${this.state.blobCount}` });
    }
    const treeMatch = /^\/repos\/([^/]+)\/([^/]+)\/git\/trees$/.exec(path);
    if (treeMatch && method === "POST") {
      this.state.treeCount += 1;
      return this.respond(response, 201, { sha: "tree-sha-0000001" });
    }
    const commitMatch = /^\/repos\/([^/]+)\/([^/]+)\/git\/commits$/.exec(path);
    if (commitMatch && method === "POST") {
      this.state.commitCount += 1;
      return this.respond(response, 201, { sha: "commit-sha-1234567" });
    }
    const refsMatch = /^\/repos\/([^/]+)\/([^/]+)\/git\/refs$/.exec(path);
    if (refsMatch && method === "POST") {
      const repository = this.find(refsMatch[1] ?? "", refsMatch[2] ?? "");
      if (!repository) return this.respond(response, 404, { message: "Not Found" });
      const body = await this.readJson(request);
      const ref = String(body.ref);
      if (repository.refs.has(ref)) return this.respond(response, 422, { message: "Reference already exists" });
      repository.refs.set(ref, String(body.sha));
      this.state.refCount += 1;
      return this.respond(response, 201, { ref, object: { sha: body.sha } });
    }
    const deleteRefMatch = /^\/repos\/([^/]+)\/([^/]+)\/git\/refs\/heads\/(.+)$/.exec(path);
    if (deleteRefMatch && method === "DELETE") {
      const repository = this.find(deleteRefMatch[1] ?? "", deleteRefMatch[2] ?? "");
      if (!repository) return this.respond(response, 404, { message: "Not Found" });
      const ref = `refs/heads/${decodeURIComponent(deleteRefMatch[3] ?? "")}`;
      if (!repository.refs.has(ref)) return this.respond(response, 422, { message: "Reference does not exist" });
      repository.refs.delete(ref);
      this.state.deletedRefs.push(ref);
      return this.respond(response, 204);
    }

    return this.respond(response, 404, { message: `Unhandled mock route ${method} ${path}` });
  }

  private find(owner: string, name: string): MockRepository | null {
    return this.state.repositories.get(`${owner}/${name}`) ?? null;
  }

  private async readJson(request: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>; } catch { return {}; }
  }

  private respond(response: import("node:http").ServerResponse, status: number, body?: unknown, text?: string): void {
    if (status === 204) { response.writeHead(204); response.end(); return; }
    if (text !== undefined) { response.writeHead(status, { "content-type": "text/plain" }); response.end(text); return; }
    response.writeHead(status, { "content-type": "application/json", "x-ratelimit-limit": "5000", "x-ratelimit-remaining": "4999", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600) });
    response.end(JSON.stringify(body ?? {}));
  }
}
