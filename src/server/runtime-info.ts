import "server-only";
import packageJson from "../../package.json";
import { getServerEnv } from "@/lib/env";

export const runtimeInfo = {
  version: (packageJson as { version?: string }).version ?? "0.0.0",
  commit: process.env.REPODECK_COMMIT_SHA?.slice(0, 12) || "unknown"
} as const;

export function readinessReport(source: Record<string, string | undefined> = process.env): { ready: boolean; reasons: string[] } {
  try {
    getServerEnv(source);
    return { ready: true, reasons: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment configuration is invalid.";
    return { ready: false, reasons: [message] };
  }
}
