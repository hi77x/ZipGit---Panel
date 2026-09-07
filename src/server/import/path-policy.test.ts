import { describe, expect, it } from "vitest";
import { assertNoCollisions, generatedReason, isPotentialSecret, normalizeZipPath, stripSingleRoot } from "./path-policy";

describe("ZIP path policy", () => {
  it("normalizes separators and rejects traversal or absolute paths", () => {
    expect(normalizeZipPath("project\\src\\index.ts")).toBe("project/src/index.ts");
    for (const path of ["../evil", "/absolute", "C:\\evil", "safe/../evil", "x\0y"]) expect(() => normalizeZipPath(path)).toThrow();
  });
  it("detects duplicate and case-insensitive collisions", () => {
    expect(() => assertNoCollisions(["README.md", "Readme.md"])).toThrow(/colliding/);
    expect(() => assertNoCollisions(["src/a.ts", "src/a.ts"])).toThrow(/colliding/);
  });
  it("blocks credential filenames but allows examples", () => {
    expect(isPotentialSecret(".env.production")).toBe(true);
    expect(isPotentialSecret("keys/id_ed25519")).toBe(true);
    expect(isPotentialSecret(".env.example")).toBe(false);
  });
  it("strips a root only when every file shares it", () => {
    expect(stripSingleRoot(["project/a", "project/src/b"])).toEqual({ paths: ["a", "src/b"], detected: true });
    expect(stripSingleRoot(["project/a", "README.md"]).detected).toBe(false);
  });
  it("reports generated exclusions", () => {
    expect(generatedReason("app/node_modules/x.js")).toContain("node_modules");
    expect(generatedReason("src/index.ts")).toBeNull();
  });
});
