import { describe, expect, it } from "vitest";
import { readinessReport } from "./runtime-info";

const validEnv = {
  AUTH_SECRET: "test-secret-test-secret-test-secret",
  AUTH_GITHUB_ID: "client",
  AUTH_GITHUB_SECRET: "secret",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000"
};

describe("health readiness", () => {
  it("reports ready when required configuration is valid", () => {
    expect(readinessReport(validEnv)).toEqual({ ready: true, reasons: [] });
  });

  it("reports unready with safe reasons when configuration is invalid", () => {
    const report = readinessReport({ ...validEnv, AUTH_SECRET: "short" });
    expect(report.ready).toBe(false);
    expect(report.reasons.join(" ")).toContain("AUTH_SECRET");
  });

  it("does not treat GitHub availability as a readiness requirement", () => {
    const report = readinessReport(validEnv);
    expect(report.ready).toBe(true);
  });
});
