import { describe, expect, it } from "vitest";
import { encodeGitHubSegment, isSafeGitHubRef, safeCallbackUrl } from "./url";

describe("URL policy", () => {
  it("allows internal callback URLs only", () => {
    expect(safeCallbackUrl("/repositories?a=1")).toBe("/repositories?a=1");
    expect(safeCallbackUrl("https://evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.example")).toBe("/dashboard");
  });
  it("encodes approved owner and repo segments", () => {
    expect(encodeGitHubSegment("hello-world")).toBe("hello-world");
    expect(() => encodeGitHubSegment("../repo")).toThrow();
  });
  it("rejects dangerous branch names", () => {
    expect(isSafeGitHubRef("feature/safe-name")).toBe(true);
    for (const ref of ["../main", "bad.lock", "x@{y", "a\\b", "/main"]) expect(isSafeGitHubRef(ref)).toBe(false);
  });
});
