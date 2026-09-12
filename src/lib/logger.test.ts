import { describe, expect, it } from "vitest";
import { sanitizeLogFields, shouldLog } from "./logger";

describe("structured log redaction", () => {
  it("drops credential-bearing keys entirely", () => {
    const safe = sanitizeLogFields({
      requestId: "abc",
      accessToken: "gho_secret",
      authorization: "Bearer gho_secret",
      content: "file body",
      archive: "zip",
      password: "hunter2",
      clientSecret: "cs",
      refresh_token: "rt",
      operationId: "op-1"
    });
    expect(safe).toEqual({ requestId: "abc", operationId: "op-1" });
  });

  it("keeps safe primitive fields and truncates long strings", () => {
    const safe = sanitizeLogFields({ stage: "BLOBS_WRITING", files: 317, truncated: true, nullable: null, detail: "x".repeat(500) });
    expect(safe).toMatchObject({ stage: "BLOBS_WRITING", files: 317, truncated: true, nullable: null });
    expect(String(safe.detail).length).toBeLessThanOrEqual(201);
  });

  it("never serializes nested objects", () => {
    const safe = sanitizeLogFields({ payload: { nested: "value" }, list: [1, 2, 3] });
    expect(safe).toEqual({});
  });

  it("honours the configured level threshold", () => {
    process.env.LOG_LEVEL = "error";
    expect(shouldLog("info")).toBe(false);
    expect(shouldLog("warn")).toBe(false);
    expect(shouldLog("error")).toBe(true);
    process.env.LOG_LEVEL = "info";
    expect(shouldLog("debug")).toBe(false);
    expect(shouldLog("info")).toBe(true);
  });
});
