import "server-only";
import { createHash } from "node:crypto";

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, string | number | boolean | null | undefined>;

export function hashUserId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function log(level: LogLevel, fields: LogFields): void {
  const safe = Object.fromEntries(
    Object.entries(fields).filter(([key, value]) =>
      value !== undefined && !/(token|cookie|authorization|inputs|content|archive)/i.test(key)
    )
  );
  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  writer(JSON.stringify({ timestamp: new Date().toISOString(), level, ...safe }));
}
