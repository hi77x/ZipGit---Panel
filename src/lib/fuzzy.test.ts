import { describe, expect, it } from "vitest";
import { fuzzyMatch, rankByFuzzy } from "./fuzzy";
import { formatBytes, formatNumber, maskSecret, percent, plural, relativeTime, truncate } from "./format";

describe("fuzzy matching", () => {
  it("matches subsequences case-insensitively", () => {
    const match = fuzzyMatch("rpdk", "RepoDeck");
    expect(match).not.toBeNull();
    expect(match?.positions).toEqual([0, 2, 4, 7]);
  });

  it("rejects non-subsequences", () => {
    expect(fuzzyMatch("zzz", "RepoDeck")).toBeNull();
  });

  it("scores exact and prefix matches higher", () => {
    expect(fuzzyMatch("deck", "deck")?.score ?? 0).toBeGreaterThan(fuzzyMatch("deck", "repodeck")?.score ?? 0);
  });

  it("ranks repositories by relevance", () => {
    const items = ["zip-import", "repodeck", "deck-tools"];
    const ranked = rankByFuzzy(items, "deck", (item) => item);
    expect(ranked[0]?.item).toBe("deck-tools");
  });
});

describe("format helpers", () => {
  it("formats bytes across magnitudes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });

  it("formats compact numbers", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1500)).toBe("1.5k");
    expect(formatNumber(2_400_000)).toBe("2.4m");
  });

  it("formats relative time and handles invalid input", () => {
    expect(relativeTime(new Date().toISOString())).toBe("just now");
    expect(relativeTime(null)).toBe("unknown");
  });

  it("formats percentages, plurals, truncation, and masks", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(1, 0)).toBe(0);
    expect(plural(1, "commit")).toBe("1 commit");
    expect(plural(3, "commit")).toBe("3 commits");
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(maskSecret("ghp_abcdefghijklmnop")).toContain("…");
  });
});
