import { afterEach, describe, expect, it } from "vitest";
import { writeZipFixture } from "@/test/zip-fixture";
import type { ImportFindingSummary } from "@/shared/contracts/import";
import { assessFindings, scanArchiveContents, unscannableCredentialFindings } from "./secret-preflight";
import { ZipReader } from "./zip-reader";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map((cleanup) => cleanup())); });

function finding(severity: ImportFindingSummary["severity"]): ImportFindingSummary {
  return { ruleId: "r", name: "n", severity, path: "a", line: 1, masked: "m", snippet: "s", remediation: "x" };
}

describe("import secret policy", () => {
  it("blocks critical and high severity and warns on the rest", () => {
    const assessed = assessFindings([finding("critical"), finding("high"), finding("medium"), finding("low"), finding("info")]);
    expect(assessed.blocking).toHaveLength(2);
    expect(assessed.warnings).toHaveLength(3);
  });

  it("turns unscannable credential files into blocking findings", () => {
    const synthetic = unscannableCredentialFindings([".env", "keys/id_rsa"]);
    expect(synthetic).toHaveLength(2);
    expect(synthetic.every((item) => item.severity === "high" && item.ruleId === "scan-budget")).toBe(true);
  });
});

describe("archive content scan", () => {
  it("returns masked findings, skips binary content, and reports budgets", async () => {
    const secret = ["ghp_", "abcdefghijklmnopqrstuvwxyz0123456789"].join("");
    const fixture = await writeZipFixture([
      { path: "README.md", content: "# Clean\n" },
      { path: "config/.env", content: `GITHUB_TOKEN=${secret}\n` },
      { path: "assets/logo.png", content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]) },
      { path: "notes.txt", content: "x".repeat(5000) }
    ]);
    cleanups.push(fixture.cleanup);
    const reader = new ZipReader();
    const archive = await reader.preflight(fixture.filePath, { excludeGenerated: false, stripSingleRoot: false });
    try {
      const result = await scanArchiveContents(reader, archive.zip, archive.entries, { maxFiles: 10, maxFileBytes: 1024, maxBytes: 4096, maxFindings: 20 });
      expect(result.blocking.some((item) => item.ruleId === "github-token")).toBe(true);
      expect(result.summary.scannedFiles).toBeGreaterThanOrEqual(1);
      expect(result.summary.skippedFiles).toBeGreaterThanOrEqual(1);
      const serialized = JSON.stringify(result.findings);
      expect(serialized).not.toContain(secret);
      expect(serialized).toContain("••");
      expect(result.summary.truncated).toBe(true);
    } finally {
      archive.zip.close();
    }
  });

  it("flags credential files that exceed the per-file scan budget", async () => {
    const fixture = await writeZipFixture([{ path: ".env", content: `PADDING=${"a".repeat(2048)}` }]);
    cleanups.push(fixture.cleanup);
    const reader = new ZipReader();
    const archive = await reader.preflight(fixture.filePath, { excludeGenerated: false, stripSingleRoot: false });
    try {
      const result = await scanArchiveContents(reader, archive.zip, archive.entries, { maxFiles: 10, maxFileBytes: 512, maxBytes: 4096, maxFindings: 20 });
      expect(result.highRiskUnscanned).toContain(".env");
      expect(result.blocking.some((item) => item.ruleId === "scan-budget")).toBe(true);
      expect(result.summary.truncated).toBe(true);
    } finally {
      archive.zip.close();
    }
  });
});
