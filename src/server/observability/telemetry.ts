import "server-only";
import { metrics, trace, SpanStatusCode, type Attributes, type Counter, type Histogram } from "@opentelemetry/api";

const meter = metrics.getMeter("repodeck");
const tracer = trace.getTracer("repodeck");
const counters = new Map<string, Counter>();
const histograms = new Map<string, Histogram>();

const sensitiveSegment = /(token|secret|password|credential|content|archive|body)/i;

export function sanitizeAttributes(attributes: Attributes | undefined): Attributes {
  const safe: Attributes = {};
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (value === undefined || value === null) continue;
    if (sensitiveSegment.test(key)) continue;
    if (typeof value === "string") safe[key] = value.length > 200 ? `${value.slice(0, 200)}…` : value;
    else if (typeof value === "number" || typeof value === "boolean") safe[key] = value;
  }
  return safe;
}

export function counter(name: string, description: string): Counter {
  const existing = counters.get(name);
  if (existing) return existing;
  const created = meter.createCounter(name, { description });
  counters.set(name, created);
  return created;
}

export function histogram(name: string, description: string, unit = "ms"): Histogram {
  const existing = histograms.get(name);
  if (existing) return existing;
  const created = meter.createHistogram(name, { description, unit });
  histograms.set(name, created);
  return created;
}

export async function withSpan<T>(name: string, attributes: Attributes, callback: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes: sanitizeAttributes(attributes) }, async (span) => {
    try {
      return await callback();
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.name : "Error" });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function addSpanEvent(name: string, attributes: Attributes = {}): void {
  trace.getActiveSpan()?.addEvent(name, sanitizeAttributes(attributes));
}

const knownRoutePrefixes = [
  "/api/imports",
  "/api/github/repositories",
  "/api/github/search",
  "/api/github/notifications",
  "/api/github/rate-limit",
  "/api/github/viewer",
  "/api/github/owners",
  "/api/health",
  "/api/auth"
];

export function normalizeRoute(pathname: string): string {
  const match = knownRoutePrefixes.find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ?? "/other";
}
