import { describe, expect, it } from "vitest";
import { normalizeRoute, sanitizeAttributes } from "./telemetry";

describe("telemetry attribute hygiene", () => {
  it("drops sensitive attribute keys", () => {
    const safe = sanitizeAttributes({ endpoint: "/repos/{owner}/{repo}", accessToken: "x", secretValue: "y", rawContent: "z", status: 200, retryable: true });
    expect(safe).toEqual({ endpoint: "/repos/{owner}/{repo}", status: 200, retryable: true });
  });

  it("truncates long attribute values and drops nested values", () => {
    const safe = sanitizeAttributes({ detail: "x".repeat(500), nested: { a: 1 } as never, count: 3 });
    expect(String(safe.detail).length).toBeLessThanOrEqual(201);
    expect(safe.nested).toBeUndefined();
    expect(safe.count).toBe(3);
  });

  it("normalizes routes to low-cardinality buckets", () => {
    expect(normalizeRoute("/api/imports")).toBe("/api/imports");
    expect(normalizeRoute("/api/github/repositories/octo/demo/contents/a/b.ts")).toBe("/api/github/repositories");
    expect(normalizeRoute("/api/github/search")).toBe("/api/github/search");
    expect(normalizeRoute("/api/health/ready")).toBe("/api/health");
    expect(normalizeRoute("/dashboard")).toBe("/other");
  });
});
