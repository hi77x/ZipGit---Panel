import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeZipFixture } from "@/test/zip-fixture";
import { ZipReader } from "./zip-reader";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function preflightFixture(files: Parameters<typeof writeZipFixture>[0]) {
  const fixture = await writeZipFixture(files);
  cleanups.push(fixture.cleanup);
  return new ZipReader().preflight(fixture.filePath, { excludeGenerated: false, stripSingleRoot: false });
}

describe("ZIP preflight regressions", () => {
  it("accepts a clean archive and records importable files", async () => {
    const archive = await preflightFixture([{ path: "README.md", content: "# ok\n" }, { path: "src/index.ts", content: "export {};\n" }]);
    try {
      expect(archive.entries.map((entry) => entry.path)).toEqual(["README.md", "src/index.ts"]);
    } finally {
      archive.zip.close();
    }
  });

  it("rejects path traversal", async () => {
    await expect(preflightFixture([{ path: "../evil.txt", content: "no" }])).rejects.toMatchObject({ code: "UNSAFE_ZIP_PATH" });
  });

  it("rejects symlink entries with a link unix mode", async () => {
    await expect(preflightFixture([{ path: "link", content: "../../etc/passwd", unixMode: 0o120777 }])).rejects.toMatchObject({ code: "UNSAFE_ZIP_PATH" });
  });

  it("rejects encrypted entries", async () => {
    await expect(preflightFixture([{ path: "secret.txt", content: "hidden", encrypted: true }])).rejects.toMatchObject({ code: "INVALID_ZIP" });
  });

  it("rejects excessive path length", async () => {
    const longName = `a/${"x".repeat(260)}.txt`;
    await expect(preflightFixture([{ path: longName, content: "x" }])).rejects.toMatchObject({ code: "PATH_TOO_LONG" });
  });

  it("rejects collision paths case-insensitively", async () => {
    await expect(preflightFixture([{ path: "README.md", content: "a" }, { path: "readme.md", content: "b" }])).rejects.toMatchObject({ code: "ZIP_PATH_COLLISION" });
  });

  it("rejects .git content", async () => {
    await expect(preflightFixture([{ path: ".git/config", content: "[core]" }])).rejects.toMatchObject({ code: "UNSAFE_ZIP_PATH" });
  });

  it("rejects a non-ZIP payload", async () => {
    const fixture = await writeZipFixture([{ path: "a.txt", content: "a" }], "archive.zip");
    cleanups.push(fixture.cleanup);
    await fs.writeFile(fixture.filePath, Buffer.from("PK\x03\x04 not really a zip"));
    await expect(new ZipReader().preflight(fixture.filePath, { excludeGenerated: false, stripSingleRoot: false })).rejects.toMatchObject({ code: "INVALID_ZIP" });
  });

  it("requires at least one importable file after generated exclusions", async () => {
    const fixture = await writeZipFixture([{ path: "app/node_modules/x.js", content: "a" }]);
    cleanups.push(fixture.cleanup);
    await expect(new ZipReader().preflight(fixture.filePath, { excludeGenerated: true, stripSingleRoot: false })).rejects.toMatchObject({ code: "ZIP_HAS_NO_IMPORTABLE_FILES" });
  });
});
