import { describe, expect, it } from "vitest";
import { IMPORT_BLOB_CONCURRENCY, IMPORT_MAX_PATH_DEPTH, IMPORT_MAX_PATH_LENGTH, importLimits } from "./constants";

describe("import limits", () => {
  it("uses the production safety ceilings", () => {
    expect(importLimits()).toMatchObject({ maxZipBytes: 104_857_600, maxUncompressedBytes: 262_144_000, maxFiles: 5_000, maxSingleFileBytes: 52_428_800 });
    expect(IMPORT_MAX_PATH_DEPTH).toBe(30);
    expect(IMPORT_MAX_PATH_LENGTH).toBe(240);
    expect(IMPORT_BLOB_CONCURRENCY).toBe(6);
  });
});
