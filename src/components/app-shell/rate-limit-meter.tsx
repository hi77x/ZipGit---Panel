"use client";
import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

type RateLimit = { remaining: number; limit: number; resetAt: string | null; used: number };

export function RateLimitMeter() {
  const [rate, setRate] = useState<RateLimit | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/github/rate-limit", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { ok: boolean; data?: RateLimit };
        if (!cancelled && payload.ok && payload.data) setRate(payload.data);
      } catch { /* rate endpoint is optional */ }
    }
    void load();
    const timer = window.setInterval(load, 120_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  if (!rate) return null;
  const percentUsed = rate.limit > 0 ? Math.min(100, Math.round((rate.used / rate.limit) * 100)) : 0;
  const tone = rate.remaining < 100 ? "danger" : rate.remaining < rate.limit * .2 ? "warning" : "success";
  const reset = rate.resetAt ? new Date(rate.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  return <span className={`rate-meter badge-${tone}`} title={`GitHub API budget: ${rate.remaining} of ${rate.limit} requests left, resets at ${reset}`}>
    <Gauge aria-hidden="true"/><b>{rate.remaining}</b>/{rate.limit}
    <span className="bar-track" style={{ width: 46, height: 4 }}><span className={`bar-fill`} style={{ width: `${100 - percentUsed}%`, background: tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : "var(--success)" }}/></span>
  </span>;
}
