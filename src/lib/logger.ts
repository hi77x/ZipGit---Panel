import "server-only";
import { createHash } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const levelOrder: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const dangerousKey = /^(?:token|access_?token|refresh_?token|authorization|cookie|set-cookie|inputs?|content|archive|body|password|passwd|secret|client_?secret|private_?key)$/i;
const dangerousSuffix = /(?:_token|_secret|_password|_credential)$/i;
const maxStringLength = 200;

export function hashUserId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function sanitizeLogFields(fields: LogFields): Record<string, string | number | boolean | null> {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || typeof value === "number" || typeof value === "boolean") {
      if (!dangerousKey.test(key) && !dangerousSuffix.test(key)) safe[key] = value;
      continue;
    }
    if (typeof value === "string") {
      if (dangerousKey.test(key) || dangerousSuffix.test(key)) continue;
      safe[key] = value.length > maxStringLength ? `${value.slice(0, maxStringLength)}…` : value;
    }
  }
  return safe;
}

export function shouldLog(level: LogLevel): boolean {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  const threshold = levelOrder[(configured as LogLevel)] ?? levelOrder.info;
  return levelOrder[level] >= threshold;
}

export function log(level: LogLevel, fields: LogFields): void {
  if (!shouldLog(level)) return;
  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  writer(JSON.stringify({ timestamp: new Date().toISOString(), level, ...sanitizeLogFields(fields) }));
}
