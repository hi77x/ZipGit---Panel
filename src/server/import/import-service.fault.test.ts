import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHubClient } from "@/server/github/client";
import { GitHubFaultServer, type MockRepository } from "@/test/github-fault-server";
import { writeZipFixture } from "@/test/zip-fixture";
import { ImportService } from "./import-service";
import type { ImportFields } from "@/shared/contracts/import";

const servers: GitHubFaultServer[] = [];
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

async function setup(options: { cleanupEnabled?: boolean } = {}): Promise<{ server: GitHubFaultServer; service: ImportService }> {
  const server = new GitHubFaultServer();
  servers.push(server);
  const baseUrl = await server.start();
  const service = new ImportService(new GitHubClient("test-token", "test-request", { baseUrl }), options);
  return { server, service };
}

async function buildArchive(entries: Array<{ path: string; content: string }>): Promise<string> {
  const fixture = await writeZipFixture(entries);
  cleanups.push(fixture.cleanup);
  return fixture.filePath;
}

async function writeRawFile(name: string, content: Buffer): Promise<string> {
  const directory = await fs.mkdtemp(join(tmpdir(), "repodeck-test-"));
  const filePath = join(directory, name);
  await fs.writeFile(filePath, content);
  cleanups.push(async () => { await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); });
  return filePath;
}

const fields: ImportFields = {
  owner: "octo", ownerType: "user", repositoryName: "imported-app", description: "",
  visibility: "private", defaultBranch: "main", commitMessage: "Import project", stripSingleRoot: false, excludeGenerated: false
};

function repository(server: GitHubFaultServer): MockRepository | undefined {
  return server.state.repositories.get("octo/imported-app");
}

function mutations(server: GitHubFaultServer): string[] {
  return server.state.requests.filter((request) => /^(POST|PATCH|DELETE) /.test(request));
}

const awsKey = ["AKIA", "ZYXWVUTSRQPONMLK"].join("");

describe("import transaction atomicity", () => {
  it("publishes exactly one branch after all objects exist", async () => {
    const { server, service } = await setup();
    const filePath = await buildArchive([{ path: "README.md", content: "# Imported\n" }, { path: "src/index.ts", content: "export const x = 1;\n" }]);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("completed");
    expect(outcome.operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(outcome.commitSha).toBe("commit-sha-1234567");
    expect(outcome.importedFileCount).toBe(2);
    expect(outcome.repository).toMatchObject({ fullName: "octo/imported-app", createdByThisOperation: true });
    expect(server.state.blobCount).toBe(2);
    expect(server.state.treeCount).toBe(1);
    expect(server.state.commitCount).toBe(1);
    expect(repository(server)?.refs.get("refs/heads/main")).toBe("commit-sha-1234567");
    expect(repository(server)?.defaultBranch).toBe("main");
  });

  it("rejects credential content before any GitHub mutation", async () => {
    const { server, service } = await setup();
    const filePath = await buildArchive([{ path: "config/.env", content: `AWS_ACCESS_KEY_ID=${awsKey}\n` }]);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("rejected");
    expect(outcome.errorCode).toBe("POTENTIAL_SECRET_DETECTED");
    expect(outcome.findings.some((finding) => finding.ruleId === "aws-access-key")).toBe(true);
    expect(mutations(server)).toEqual([]);
    expect(server.state.repositories.size).toBe(0);
    const serialized = JSON.stringify(outcome);
    expect(serialized).not.toContain(awsKey);
    expect(serialized).toContain("••");
  });

  it("allows a credential-looking filename when its content is clean", async () => {
    const { server, service } = await setup();
    const filePath = await buildArchive([{ path: ".env", content: "NODE_ENV=production\n" }, { path: "README.md", content: "# ok\n" }]);
    const outcome = await service.execute(filePath, fields);
    expect(outcome.status).toBe("completed");
    expect(repository(server)?.refs.size).toBe(1);
  });

  it("stops queued blob writes after a mid-upload failure and publishes no branch", async () => {
    const { server, service } = await setup();
    server.blobFailureAfter = 8;
    const files = Array.from({ length: 40 }, (_, index) => ({ path: `src/file-${index}.ts`, content: `export const value = ${index};\n` }));
    const filePath = await buildArchive(files);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("cleanup_incomplete");
    expect(outcome.stage).toBe("COMPENSATING");
    expect(outcome.cleanup.repositoryRemainder).toBe(true);
    expect(outcome.cleanup.refDeleted).toBe(false);
    expect(outcome.repository?.fullName).toBe("octo/imported-app");
    expect(repository(server)?.refs.size).toBe(0);
    expect(server.state.requests.filter((request) => request === "POST /repos/octo/imported-app/git/blobs").length).toBeLessThan(40);
    expect(outcome.remediation).toContain("octo/imported-app");
  });

  it.each([
    ["tree", { method: "POST", path: /\/git\/trees$/, status: 500, times: 1 }],
    ["commit", { method: "POST", path: /\/git\/commits$/, status: 500, times: 1 }],
    ["ref", { method: "POST", path: /\/git\/refs$/, status: 500, times: 1 }]
  ])("never publishes a branch when %s creation fails", async (_stage, rule) => {
    const { server, service } = await setup();
    server.addRule(rule);
    const filePath = await buildArchive([{ path: "README.md", content: "# Imported\n" }]);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("cleanup_incomplete");
    expect(repository(server)?.refs.size).toBe(0);
    expect(outcome.cleanup.refDeleted).toBe(false);
    expect(server.state.deletedRefs).toEqual([]);
  });

  it("deletes the published ref when the default branch update fails", async () => {
    const { server, service } = await setup();
    server.addRule({ method: "PATCH", path: /^\/repos\/octo\/imported-app$/, status: 500, times: 1 });
    const filePath = await buildArchive([{ path: "README.md", content: "# Imported\n" }]);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("cleanup_incomplete");
    expect(outcome.cleanup.refDeleted).toBe(true);
    expect(server.state.deletedRefs).toEqual(["refs/heads/main"]);
    expect(repository(server)?.refs.size).toBe(0);
  });

  it("reports compensated only when the repository is actually removed", async () => {
    const { server, service } = await setup({ cleanupEnabled: true });
    server.blobFailureAfter = 1;
    const filePath = await buildArchive([{ path: "a.txt", content: "a\n" }, { path: "b.txt", content: "b\n" }]);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("compensated");
    expect(outcome.cleanup.repositoryDeleted).toBe(true);
    expect(outcome.cleanup.repositoryRemainder).toBe(false);
    expect(server.state.deletedRepositories).toEqual(["octo/imported-app"]);
    expect(server.state.repositories.size).toBe(0);
  });

  it("stays honest when repository deletion is not permitted", async () => {
    const { server, service } = await setup({ cleanupEnabled: true });
    server.deletableRepositories = false;
    server.blobFailureAfter = 1;
    const filePath = await buildArchive([{ path: "a.txt", content: "a\n" }, { path: "b.txt", content: "b\n" }]);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("cleanup_incomplete");
    expect(outcome.cleanup.repositoryDeleted).toBe(false);
    expect(outcome.cleanup.repositoryRemainder).toBe(true);
    expect(outcome.remediation).toContain("REPODECK_ALLOW_REPOSITORY_CLEANUP=true");
  });

  it("recovers from a dropped connection during upload", async () => {
    const { server, service } = await setup();
    server.addRule({ method: "POST", path: /\/git\/blobs$/, drop: true, times: 1 });
    const filePath = await buildArchive([{ path: "a.txt", content: "a\n" }, { path: "b.txt", content: "b\n" }, { path: "c.txt", content: "c\n" }]);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("cleanup_incomplete");
    expect(repository(server)?.refs.size).toBe(0);
  });

  it("fails cleanly before repository creation on rate limit", async () => {
    const { server, service } = await setup();
    server.addRule({ method: "POST", path: "/user/repos", status: 429, times: 1, body: { message: "API rate limit exceeded" } });
    const filePath = await buildArchive([{ path: "README.md", content: "# Imported\n" }]);
    const outcome = await service.execute(filePath, fields);

    expect(outcome.status).toBe("failed");
    expect(outcome.errorCode).toBe("GITHUB_RATE_LIMITED");
    expect(server.state.repositories.size).toBe(0);
    expect(outcome.remediation).toContain("Retry");
  });

  it("classifies malformed upstream payloads distinctly and mutates nothing", async () => {
    const { server, service } = await setup();
    server.addRule({ method: "GET", path: "/user", status: 200, text: "not-json", times: 1 });
    const filePath = await buildArchive([{ path: "README.md", content: "# Imported\n" }]);
    await expect(service.execute(filePath, fields)).rejects.toMatchObject({ name: "GitHubApiError", details: { status: -2 } });
    expect(mutations(server)).toEqual([]);
  });

  it("rejects a non-ZIP archive before any GitHub request", async () => {
    const { server, service } = await setup();
    const filePath = await writeRawFile("archive.zip", Buffer.from("this is not a zip archive"));
    await expect(service.execute(filePath, fields)).rejects.toMatchObject({ name: "AppError", code: "INVALID_ZIP" });
    expect(server.state.requests).toEqual([]);
  });

  it("rejects archives whose credential files exceed the scan budget", async () => {
    const { server, service } = await setup();
    const bigEnv = `PADDING=${"a".repeat(600 * 1024)}\n`;
    const filePath = await buildArchive([{ path: ".env", content: bigEnv }]);
    const outcome = await service.execute(filePath, fields);
    expect(outcome.status).toBe("rejected");
    expect(outcome.findings.some((finding) => finding.ruleId === "scan-budget")).toBe(true);
    expect(mutations(server)).toEqual([]);
  });
});
