import { describe, expect, it } from "vitest";
import { validateContentPath } from "./content-service";
import { validateBranchName } from "./branch-service";

describe("content path validation", () => {
  it("rejects traversal, absolute, and reserved paths", () => {
    expect(() => validateContentPath("../secret")).toThrow();
    expect(() => validateContentPath("src/../../secret")).toThrow();
    expect(() => validateContentPath("/etc/passwd")).toThrow();
    expect(() => validateContentPath(".git/config")).toThrow();
    expect(() => validateContentPath("src\\main.ts")).toThrow();
    expect(() => validateContentPath("")).toThrow();
  });
  it("accepts repository-relative paths and the empty tree path", () => {
    expect(validateContentPath("src/features/code-explorer/explorer.tsx")).toBe("src/features/code-explorer/explorer.tsx");
    expect(validateContentPath(".github/workflows/ci.yml")).toBe(".github/workflows/ci.yml");
    expect(validateContentPath("", { allowEmpty: true })).toBe("");
  });
});

describe("branch name validation", () => {
  it("rejects reserved and unsafe names", () => {
    expect(() => validateBranchName("HEAD")).toThrow();
    expect(() => validateBranchName("bad name")).toThrow();
    expect(() => validateBranchName("-lead")).toThrow();
    expect(() => validateBranchName("feature//x")).toThrow();
    expect(() => validateBranchName("release.lock")).toThrow();
    expect(() => validateBranchName("feature@{1}")).toThrow();
  });
  it("accepts common branch names", () => {
    expect(validateBranchName("main")).toBe("main");
    expect(validateBranchName("feature/code-explorer")).toBe("feature/code-explorer");
  });
});
