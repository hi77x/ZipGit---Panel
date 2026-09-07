import "server-only";
import { getServerEnv } from "@/lib/env";

export const IMPORT_MAX_PATH_DEPTH = 30;
export const IMPORT_MAX_PATH_LENGTH = 240;
export const IMPORT_BLOB_CONCURRENCY = 6;

export function importLimits() {
  const env = getServerEnv();
  return {
    maxZipBytes: env.IMPORT_MAX_ZIP_BYTES,
    maxUncompressedBytes: env.IMPORT_MAX_UNCOMPRESSED_BYTES,
    maxFiles: env.IMPORT_MAX_FILES,
    maxSingleFileBytes: env.IMPORT_MAX_SINGLE_FILE_BYTES,
    maxPathDepth: IMPORT_MAX_PATH_DEPTH,
    maxPathLength: IMPORT_MAX_PATH_LENGTH,
    blobConcurrency: IMPORT_BLOB_CONCURRENCY
  } as const;
}

export const GENERATED_PATTERNS = ["node_modules", ".next", "dist", "build", "coverage", ".turbo", ".cache"] as const;
