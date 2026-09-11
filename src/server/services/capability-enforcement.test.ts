import { afterEach, describe, expect, it } from "vitest";
import { GitHubClient } from "@/server/github/client";
import { GitHubFaultServer } from "@/test/github-fault-server";
import type { RepositoryPermissionFlags } from "@/shared/contracts/repository";
import { ContentService } from "./content-service";
import { PullService } from "./pull-service";

const servers: GitHubFaultServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

async function setup(permissions: RepositoryPermissionFlags, archived = false) {
  const server = new GitHubFaultServer();
  server.defaultPermissions = permissions;
  server.defaultArchived = archived;
  servers.push(server);
  const baseUrl = await server.start();
  server.state.repositories.set("octo/demo", { owner: "octo", name: "demo", defaultBranch: "main", refs: new Map(), permissions, archived });
  return { server, client: new GitHubClient("test-token", "cap-test", { baseUrl }) };
}

describe("server-side capability enforcement", () => {
  it("denies file writes for a read-only collaborator before any mutation", async () => {
    const { server, client } = await setup({ pull: true });
    await expect(new ContentService(client).write("octo", "demo", { path: "README.md", content: "x", message: "edit", branch: "main" }))
      .rejects.toMatchObject({ code: "CAPABILITY_DENIED", status: 403 });
    expect(server.state.requests.filter((request) => request.startsWith("PUT") || request.startsWith("DELETE"))).toEqual([]);
  });

  it("denies merge for a triage collaborator even though triage can manage issues", async () => {
    const { server, client } = await setup({ pull: true, triage: true });
    await expect(new PullService(client).merge("octo", "demo", 1, { method: "merge" }))
      .rejects.toMatchObject({ code: "CAPABILITY_DENIED" });
    expect(server.state.requests.some((request) => request.includes("/merge"))).toBe(false);
  });

  it("allows writes for a collaborator with push access", async () => {
    const { server, client } = await setup({ pull: true, triage: true, push: true });
    const result = await new ContentService(client).write("octo", "demo", { path: "README.md", content: "x", message: "edit", branch: "main" });
    expect(result.commit.sha).toBe("commit-sha-1234567");
    expect(server.state.requests.some((request) => request.startsWith("PUT /repos/octo/demo/contents/"))).toBe(true);
  });

  it("denies mutations on archived repositories regardless of role", async () => {
    const { server, client } = await setup({ admin: true, maintain: true, push: true, triage: true, pull: true }, true);
    await expect(new ContentService(client).write("octo", "demo", { path: "README.md", content: "x", message: "edit", branch: "main" }))
      .rejects.toMatchObject({ code: "CAPABILITY_DENIED" });
    expect(server.state.requests.some((request) => request.startsWith("PUT"))).toBe(false);
  });

  it("denies merge when the token lost write access mid-session", async () => {
    const { server, client } = await setup({ pull: true, triage: true, push: true });
    const repository = server.state.repositories.get("octo/demo");
    if (repository) repository.permissions = { pull: true, triage: true, push: false };
    await expect(new PullService(client).merge("octo", "demo", 1, { method: "squash" }))
      .rejects.toMatchObject({ code: "CAPABILITY_DENIED" });
    expect(server.state.requests.some((request) => request.includes("/merge"))).toBe(false);
  });
});
