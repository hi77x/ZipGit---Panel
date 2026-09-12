import { NextResponse } from "next/server";
import { readinessReport, runtimeInfo } from "@/server/runtime-info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = readinessReport();
  const body = {
    ok: report.ready,
    data: { status: report.ready ? "ready" as const : "unready" as const, version: runtimeInfo.version, commit: runtimeInfo.commit, reasons: report.reasons },
    meta: { requestId: crypto.randomUUID(), rateLimit: null }
  };
  return NextResponse.json(body, { status: report.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
