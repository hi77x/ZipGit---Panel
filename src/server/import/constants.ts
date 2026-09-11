import "server-only";
import { getServerEnv } from "@/lib/env";

export const IMPORT_MAX_PATH_DEPTH = 30;
export const IMPORT_MAX_PATH_LENGTH = 240;
export const IMPORT_BLOB_CONCURRENCY = 6;
export const IMPORT_BLOB_TIMEOUT_MS = 60_000;
export const IMPORT_MUTATION_TIMEOUT_MS = 30_000;

export function importLimits() {
  const env = getServerEnv();
  return {
    maxZipBytes: env.IMPORT_MAX_ZIP_BYTES,
    maxUncompressedBytes: env.IMPORT_MAX_UNCOMPRESSED_BYTES,
    maxFiles: env.IMPORT_MAX_FILES,
    maxSingleFileBytes: env.IMPORT_MAX_SINGLE_FILE_BYTES,
    maxPathDepth: IMPORT_MAX_PATH_DEPTH,
    maxPathLength: IMPORT_MAX_PATH_LENGTH,
    blobConcurrency: IMPORT_BLOB_CONCURRENCY,
    blobTimeoutMs: IMPORT_BLOB_TIMEOUT_MS,
    scan: {
      maxFiles: env.IMPORT_MAX_SCAN_FILES,
      maxFileBytes: env.IMPORT_MAX_SCAN_FILE_BYTES,
      maxBytes: env.IMPORT_MAX_SCAN_BYTES,
      maxFindings: env.IMPORT_MAX_SCAN_FINDINGS
    }
  } as const;
}

export function repositoryCleanupEnabled(): boolean {
  return getServerEnv().REPODECK_ALLOW_REPOSITORY_CLEANUP;
}

export const GENERATED_PATTERNS = ["node_modules", ".next", "dist", "build", "coverage", ".turbo", ".cache"] as const;
