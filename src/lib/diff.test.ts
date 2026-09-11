import { describe, expect, it } from "vitest";
import { changeKind, isLargePatch, parsePatch, patchStats, totalDiffStats } from "./diff";

const patch = [
  "@@ -1,4 +1,5 @@",
  " context one",
  "-old line",
  "+new line",
  "+extra line",
  " context two",
  "\\ No newline at end of file"
].join("\n");

describe("unified diff parser", () => {
  it("parses hunks with correct line numbers and stats", () => {
    const parsed = parsePatch(patch);
    expect(parsed.hunks).toHaveLength(1);
    const hunk = parsed.hunks[0];
    expect(hunk?.oldStart).toBe(1);
    expect(hunk?.newStart).toBe(1);
    expect(parsed.additions).toBe(2);
    expect(parsed.deletions).toBe(1);
    const lines = hunk?.lines ?? [];
    expect(lines[0]).toMatchObject({ type: "ctx", oldNumber: 1, newNumber: 1 });
    expect(lines[1]).toMatchObject({ type: "del", oldNumber: 2, newNumber: null });
    expect(lines[2]).toMatchObject({ type: "add", oldNumber: null, newNumber: 2 });
    expect(lines[3]).toMatchObject({ type: "add", oldNumber: null, newNumber: 3 });
    expect(lines[4]).toMatchObject({ type: "ctx", oldNumber: 3, newNumber: 4 });
  });

  it("returns empty structures for missing patches", () => {
    expect(parsePatch(null)).toEqual({ hunks: [], additions: 0, deletions: 0, binary: false });
  });

  it("ignores file headers when counting stats", () => {
    const stats = patchStats(`--- a/file\n+++ b/file\n@@ -1 +1 @@\n-a\n+b`);
    expect(stats).toEqual({ additions: 1, deletions: 1 });
  });

  it("classifies change kinds", () => {
    expect(changeKind("added", 3, 0)).toBe("added");
    expect(changeKind("removed", 0, 2)).toBe("removed");
    expect(changeKind("renamed", 1, 1)).toBe("renamed");
    expect(changeKind(null, 1, 1)).toBe("modified");
  });

  it("detects large patches and totals stats", () => {
    expect(isLargePatch("a\nb\nc", 2)).toBe(true);
    expect(isLargePatch("a\nb", 2)).toBe(false);
    expect(totalDiffStats([{ additions: 2, deletions: 1 }, { additions: 5 }])).toEqual({ additions: 7, deletions: 1 });
  });
});
