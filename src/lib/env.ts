import "server-only";
import { z } from "zod";

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

export const serverEnvSchema = z.object({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must contain at least 32 characters"),
  AUTH_GITHUB_ID: z.string().min(1, "AUTH_GITHUB_ID is required"),
  AUTH_GITHUB_SECRET: z.string().min(1, "AUTH_GITHUB_SECRET is required"),
  NEXT_PUBLIC_APP_URL: z.url(),
  GITHUB_API_BASE_URL: z.url().default("https://api.github.com"),
  GITHUB_API_VERSION: z.string().default("2022-11-28"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  IMPORT_MAX_ZIP_BYTES: positiveInt(100 * 1024 * 1024),
  IMPORT_MAX_UNCOMPRESSED_BYTES: positiveInt(250 * 1024 * 1024),
  IMPORT_MAX_FILES: positiveInt(5_000),
  IMPORT_MAX_SINGLE_FILE_BYTES: positiveInt(50 * 1024 * 1024),
  IMPORT_MAX_SCAN_FILES: positiveInt(400),
  IMPORT_MAX_SCAN_FILE_BYTES: positiveInt(512 * 1024),
  IMPORT_MAX_SCAN_BYTES: positiveInt(8 * 1024 * 1024),
  IMPORT_MAX_SCAN_FINDINGS: positiveInt(200),
  REPODECK_ALLOW_REPOSITORY_CLEANUP: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  REPODECK_COMMIT_SHA: z.string().max(64).optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  if (source === process.env && cached) return cached;
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean);
    throw new Error(`Invalid server environment: ${[...new Set(names)].join(", ")}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}
