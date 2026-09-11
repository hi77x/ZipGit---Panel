import { describe, expect, it } from "vitest";
import { maskValue, scanText, shannonEntropy, summarizeFindings } from "./secret-rules";

const awsKey = ["AKIA", "ZYXWVUTSRQPONMLK"].join("");
const githubToken = ["ghp_", "abcdefghijklmnopqrstuvwxyz0123456789"].join("");
const privateKeyHeader = ["-----BEGIN RSA ", "PRIVATE KEY-----"].join("");
const connectionString = `postgres://user:${["super", "secret"].join("")}@db.internal/app`;

describe("secret scanner", () => {
  it("detects AWS and GitHub credentials", () => {
    const findings = scanText(`AWS_KEY=${awsKey}\nTOKEN=${githubToken}`, "config.env");
    const ids = findings.map((finding) => finding.ruleId);
    expect(ids).toContain("aws-access-key");
    expect(ids).toContain("github-token");
    expect(findings.every((finding) => finding.severity === "critical")).toBe(true);
  });

  it("masks the raw credential in snippets", () => {
    const secret = awsKey;
    const finding = scanText(`key = ${secret}`, "a.txt")[0];
    expect(finding?.match).toBe(secret);
    expect(finding?.masked).not.toBe(secret);
    expect(finding?.snippet).not.toContain(secret);
    expect(finding?.snippet).toContain(finding?.masked ?? "");
  });

  it("reports private keys and connection strings", () => {
    const findings = scanText(`${privateKeyHeader}\n${connectionString}`, "secrets.md");
    expect(findings.some((finding) => finding.ruleId === "private-key")).toBe(true);
    expect(findings.some((finding) => finding.ruleId === "connection-string")).toBe(true);
  });

  it("skips placeholders and environment references", () => {
    expect(scanText(`api_key = "your-example-key-should-not-flag"`, "readme.md")).toHaveLength(0);
    expect(scanText(`password = "somevalue1234567890"`, "b.txt").some((finding) => finding.ruleId === "generic-secret" && finding.severity === "low")).toBe(true);
  });

  it("computes entropy and severity summaries", () => {
    expect(shannonEntropy("aaaaaaaa")).toBeLessThan(1);
    expect(shannonEntropy("aB3$xY9!qW2@")).toBeGreaterThan(3);
    const summary = summarizeFindings([
      { id: "1", ruleId: "aws-access-key", name: "x", description: "", severity: "critical", path: "a", line: 1, column: 1, match: "m", masked: "m", snippet: "", remediation: "" },
      { id: "2", ruleId: "jwt", name: "x", description: "", severity: "medium", path: "a", line: 2, column: 1, match: "m", masked: "m", snippet: "", remediation: "" }
    ]);
    expect(summary.total).toBe(2);
    expect(summary.bySeverity.critical).toBe(1);
    expect(summary.affectedFiles).toBe(1);
    expect(summary.riskScore).toBeGreaterThan(40);
  });

  it("masks short and long values safely", () => {
    expect(maskValue("short")).toBe("•••••");
    expect(maskValue("abcdefghijklmnop")).toContain("abcd");
    expect(maskValue("abcdefghijklmnop").length).toBeLessThan(20);
  });
});
