import { describe, expect, it } from "vitest";
import { getServerEnv } from "./env";

const valid = { AUTH_SECRET: "x".repeat(32), AUTH_GITHUB_ID: "id", AUTH_GITHUB_SECRET: "secret", NEXT_PUBLIC_APP_URL: "http://localhost:3000" };

describe("server environment", () => {
  it("parses defaults and numeric overrides", () => {
    const env = getServerEnv({ ...valid, IMPORT_MAX_FILES: "42" });
    expect(env.IMPORT_MAX_FILES).toBe(42);
    expect(env.GITHUB_API_VERSION).toBe("2022-11-28");
  });
  it("names invalid variables without revealing values", () => {
    expect(() => getServerEnv({ ...valid, AUTH_SECRET: "short", AUTH_GITHUB_SECRET: "do-not-print-this", NEXT_PUBLIC_APP_URL: "bad" })).toThrow(/AUTH_SECRET, NEXT_PUBLIC_APP_URL/);
    try { getServerEnv({ ...valid, AUTH_SECRET: "short" }); } catch (error) { expect(String(error)).not.toContain("short"); }
  });
});
