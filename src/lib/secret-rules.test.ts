import { describe, expect, it } from "vitest";
import { maskValue, scanFiles, scanText, severityRank, severityWeight, shannonEntropy, summarizeFindings, toPublicFinding } from "./secret-rules";

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

  it("detects cloud, payment, and messaging credentials", () => {
    const cases: Array<[string, string]> = [
      [["AI", "zaSyB1234567890abcdefghijklmnopqrstuv"].join(""), "google-api-key"],
      [["sk", "_live_", "1234567890abcdefghijklmnop"].join(""), "stripe-live-key"],
      [["xoxb", "-123456789012-abcdefghijklmnop"].join(""), "slack-token"],
      [["key", "-", "0123456789abcdef0123456789abcdef"].join(""), "mailgun-key"],
      [["SG", ".", "abcdefghijklmnopqrstuv", ".", "abcdefghijklmnopqrstuvwxyz01234567890ABCDEFG"].join(""), "sendgrid-key"],
      [["dop", "_v1_", "a".repeat(64)].join(""), "digitalocean-token"],
      [["shpat", "_", "abcdef0123456789abcdef0123456789"].join(""), "shopify-token"],
      [["hf", "_", "abcdefghijklmnopqrstuvwxyz123456"].join(""), "huggingface-token"],
      ["login.postgres://postgres:not-a-real-credential@db.local:5432/app", "connection-string"],
      ["https://user:topsecretvalue@internal.corp/api", "basic-auth-url"]
    ];
    for (const [content, expectedRule] of cases) {
      const findings = scanText(content, "config.ts");
      expect(findings.map((finding) => finding.ruleId), content).toContain(expectedRule);
    }
  });

  it("flags JWT, Azure keys, openai, and anthropic tokens", () => {
    const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"].join(".");
    const azure = `AccountKey=${"A".repeat(88)}`;
    const openai = ["sk-proj-", "abcdefghijklmnopqrstuv", "T3BlbkFJ", "abcdefghijklmnopqrstuv"].join("");
    const anthropic = ["sk-ant-api03-", "abcdefghijklmnopqrstuvwxyz"].join("");
    expect(scanText(jwt, "a.ts")[0]?.ruleId).toBe("jwt");
    expect(scanText(azure, "b.ts")[0]?.ruleId).toBe("azure-account-key");
    expect(scanText(openai, "c.ts")[0]?.ruleId).toBe("openai-key");
    expect(scanText(anthropic, "d.ts")[0]?.ruleId).toBe("anthropic-key");
  });

  it("supports file batches with a size budget", () => {
    const secret = ["AKIA", "ZYXWVUTSRQPONMLK"].join("");
    const findings = scanFiles([{ path: "small.env", content: `KEY=${secret}` }, { path: "big.env", content: `KEY=${secret}\n${"x".repeat(100)}` }], { maxFileBytes: 40 });
    expect(findings.some((finding) => finding.path === "small.env")).toBe(true);
    expect(findings.some((finding) => finding.path === "big.env")).toBe(false);
  });

  it("orders severities and strips raw matches from public findings", () => {
    expect(severityWeight("critical")).toBeGreaterThan(severityWeight("low"));
    expect(severityRank("critical")).toBeLessThan(severityRank("info"));
    expect(severityWeight("info")).toBe(1);
    expect(severityRank("info")).toBe(4);
    const secret = ["AKIA", "ZYXWVUTSRQPONMLK"].join("");
    const internal = scanText(`key = ${secret}`, "a.txt")[0];
    expect(internal).toBeDefined();
    const publicFinding = toPublicFinding(internal as NonNullable<typeof internal>);
    expect("match" in publicFinding).toBe(false);
    expect(publicFinding.masked).toBe(internal?.masked);
    expect(JSON.stringify(publicFinding)).not.toContain(secret);
  });
});
