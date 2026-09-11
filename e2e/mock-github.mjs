import { createServer } from "node:http";

let pagesEnabled = false;
let repositoryCreations = 0;
let blobCount = 0;

const repository = {
  id: 101, name: "demo", full_name: "octo/demo", private: false, visibility: "public",
  description: "Deterministic GitHub fixture", language: "TypeScript", stargazers_count: 7, forks_count: 2,
  updated_at: "2026-09-07T07:00:00.000Z", default_branch: "main", html_url: "https://github.com/octo/demo",
  owner: { login: "octo", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" }
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:4010");
  const path = url.pathname;
  response.setHeader("x-ratelimit-limit", "5000"); response.setHeader("x-ratelimit-remaining", "4999");
  response.setHeader("x-ratelimit-reset", String(Math.floor(Date.now() / 1000) + 3600)); response.setHeader("x-github-request-id", "MOCK-REQUEST");
  if (path === "/__health") return json(response, 200, { ok: true });
  if (path === "/__reset" && request.method === "POST") { pagesEnabled = false; repositoryCreations = 0; blobCount = 0; return json(response, 200, { ok: true }); }
  if (path === "/__state") return json(response, 200, { pagesEnabled, repositoryCreations, blobCount });
  if (request.headers.authorization !== "Bearer e2e-access-token") return json(response, 401, { message: "Bad credentials" });
  if (path === "/user") return json(response, 200, { id: 1, login: "octo", name: "Octo Test", email: "octo@example.test", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" });
  if (path === "/user/orgs") return json(response, 200, []);
  if (path === "/rate_limit") return json(response, 200, { resources: { core: { limit: 5000, used: 10, remaining: 4990, reset: Math.floor(Date.now() / 1000) + 3600 } } });
  if (path === "/notifications") return json(response, 200, []);
  if (path === "/user/repos" && request.method === "GET") return json(response, 200, [repository]);
  if (path === "/user/repos" && request.method === "POST") { repositoryCreations += 1; return json(response, 201, { full_name: "octo/imported-app", html_url: "https://github.com/octo/imported-app", name: "imported-app", owner: { login: "octo" } }); }
  if (path === "/repos/octo/demo") return json(response, 200, repository);
  if (path === "/repos/octo/demo/branches") return json(response, 200, [{ name: "main" }]);
  if (path === "/repos/octo/demo/readme" && request.headers.accept?.includes("raw")) return text(response, 200, "# Demo\n\n| Safe | Value |\n| --- | --- |\n| yes | 1 |\n\n<img src=x onerror=alert(1)><script>alert(1)</script>", "text/plain");
  if (path === "/repos/octo/demo/readme") return json(response, 200, { path: "README.md", name: "README.md", sha: "abc1234", html_url: "https://github.com/octo/demo/blob/main/README.md" });
  if (path === "/markdown" && request.method === "POST") return text(response, 200, '<h1 id="demo">Demo</h1><table><tr><td>safe</td></tr></table><img src="x" onerror="alert(1)"><script>alert(1)</script>', "text/html");
  if (path === "/repos/octo/demo/events") return json(response, 200, [{ id: "event-1", type: "PushEvent", created_at: "2026-09-07T07:00:00.000Z", actor: { login: "octo", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" }, payload: { ref: "refs/heads/main", commits: [{ sha: "a" }] } }]);
  if (path === "/repos/octo/demo/pages" && request.method === "GET") return pagesEnabled ? json(response, 200, { html_url: null, status: "building", build_type: "workflow", https_enforced: true }) : json(response, 404, { message: "Not Found" });
  if (path === "/repos/octo/demo/pages" && (request.method === "POST" || request.method === "PATCH")) { pagesEnabled = true; return json(response, 201, {}); }
  if (path === "/repos/octo/demo/pages/builds/latest") return json(response, 404, { message: "Not Found" });
  if (path === "/repos/octo/demo/pages/builds" && request.method === "POST") return json(response, 201, { status: "queued" });
  if (path === "/repos/octo/demo/actions/workflows") return json(response, 200, { total_count: 1, workflows: [{ id: 9, name: "CI", path: ".github/workflows/ci.yml", state: "active", html_url: "https://github.com/octo/demo/actions/workflows/ci.yml" }] });
  if (path === "/repos/octo/demo/contents/.github/workflows/ci.yml") return text(response, 200, "name: CI\non:\n  workflow_dispatch:\n  push:\n", "text/plain");
  if (path === "/repos/octo/demo/actions/runs") return json(response, 200, { total_count: 1, workflow_runs: [{ id: 10, name: "CI", status: "completed", conclusion: "success", event: "push", head_branch: "main", head_sha: "abcdef123456", html_url: "https://github.com/octo/demo/actions/runs/10", created_at: "2026-09-07T07:00:00.000Z", updated_at: "2026-09-07T07:01:00.000Z", actor: { login: "octo", avatar_url: null }, workflow_id: 9 }] });
  if (path === "/repos/octo/demo/actions/workflows/9/dispatches" && request.method === "POST") return empty(response, 204);
  if (path.startsWith("/repos/octo/demo/actions/runs/10/") && request.method === "POST") return empty(response, 204);
  if (path === "/repos/octo/imported-app/git/blobs" && request.method === "POST") { blobCount += 1; return json(response, 201, { sha: `blobsha${blobCount}` }); }
  if (path === "/repos/octo/imported-app/git/trees" && request.method === "POST") return json(response, 201, { sha: "treesha123" });
  if (path === "/repos/octo/imported-app/git/commits" && request.method === "POST") return json(response, 201, { sha: "commitsha123456789" });
  if (path === "/repos/octo/imported-app/git/refs" && request.method === "POST") return json(response, 201, { ref: "refs/heads/main" });
  if (path === "/repos/octo/imported-app" && request.method === "PATCH") return json(response, 200, {});
  if (path === "/repos/octo/imported-app/git/ref/heads/main") return json(response, 200, { ref: "refs/heads/main", object: { sha: "commitsha123456789" } });
  return json(response, 404, { message: `Unhandled mock route ${request.method} ${path}` });
});

function json(response, status, body) { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(body)); }
function text(response, status, body, type) { response.writeHead(status, { "content-type": type }); response.end(body); }
function empty(response, status) { response.writeHead(status); response.end(); }
server.listen(4010, "127.0.0.1");
