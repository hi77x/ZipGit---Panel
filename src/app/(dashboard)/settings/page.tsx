import Image from "next/image";
import { Gauge, Palette, ShieldCheck, Terminal, User } from "lucide-react";
import { z } from "zod";
import { Card, Metric } from "@/components/ui/card";
import { ErrorState, PermissionState } from "@/components/feedback/states";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";
import { AppError } from "@/shared/contracts/api-error";
import { formatDateTime, formatNumber } from "@/lib/format";

const rateLimitSchema = z.object({
  resources: z.object({
    core: z.object({ limit: z.number(), used: z.number(), remaining: z.number(), reset: z.number() }),
    search: z.object({ limit: z.number(), used: z.number(), remaining: z.number(), reset: z.number() }).optional()
  })
});

export default async function SettingsPage() {
  let viewer: Awaited<ReturnType<RepositoryService["viewer"]>> | null = null;
  let rate: z.infer<typeof rateLimitSchema>["resources"] | null = null;
  let loadError: unknown;
  try {
    const { accessToken } = await requireGitHubSession();
    const github = new GitHubClient(accessToken, crypto.randomUUID());
    const [viewerData, rateResult] = await Promise.all([
      new RepositoryService(github).viewer(),
      github.request({ path: "/rate_limit", schema: rateLimitSchema, endpointTemplate: "/rate_limit" })
    ]);
    viewer = viewerData;
    rate = rateResult.data.resources;
  } catch (error) {
    loadError = error;
  }
  if (loadError || !viewer || !rate) {
    if (loadError instanceof AppError && (loadError.code === "UNAUTHENTICATED" || loadError.code === "AUTH_RECONNECT_REQUIRED")) {
      return <div className="page"><PermissionState message={loadError.message}/></div>;
    }
    return <div className="page"><ErrorState message="Account details could not be loaded from GitHub. Try again when GitHub is reachable."/></div>;
  }
  const core = rate.core;
  const resetAt = core.reset ? new Date(core.reset * 1000).toISOString() : null;

  return <div className="page">
    <header className="page-header">
      <div><span className="eyebrow"><User/> Account</span><h1>Settings</h1><p>Connection details, API budget, appearance, and deployment information for this RepoDeck instance.</p></div>
    </header>

    <div className="grid-2">
      <Card>
        <span className="card-label">GitHub account</span>
        <div className="cluster" style={{ marginTop: 14 }}>
          {viewer.avatarUrl ? <Image className="avatar avatar-lg" src={viewer.avatarUrl} alt="" width={46} height={46}/> : <User aria-hidden="true"/>}
          <div><strong>{viewer.login}</strong><p className="muted text-sm" style={{ margin: "2px 0 0" }}>{viewer.name ?? "No display name set"}</p></div>
        </div>
        <dl className="detail-list">
          <div><dt>Email</dt><dd>{viewer.email ?? "Private"}</dd></div>
          <div><dt>Account ID</dt><dd>{viewer.id}</dd></div>
        </dl>
      </Card>

      <Card>
        <span className="card-label">API budget</span>
        <div className="metric-grid" style={{ marginTop: 14 }}>
          <Metric label="Remaining" value={formatNumber(core.remaining)} icon={<Gauge/>} hint={`of ${formatNumber(core.limit)} per hour`}/>
          <Metric label="Used" value={formatNumber(core.used)} icon={<Gauge/>} hint="since the last reset"/>
        </div>
        <p className="muted text-xs" style={{ margin: "14px 0 0" }}>Core budget resets {resetAt ? formatDateTime(resetAt) : "on a rolling hourly window"}.{rate.search ? ` Search budget: ${formatNumber(rate.search.remaining)} of ${formatNumber(rate.search.limit)} remaining.` : ""}</p>
      </Card>

      <Card>
        <span className="card-label"><Palette style={{ width: 12, height: 12, verticalAlign: "-2px" }}/> Appearance</span>
        <p className="muted text-sm" style={{ margin: "12px 0 0" }}>Use the theme toggle in the topbar to switch between dark and light modes. The preference is stored in this browser and applied before the page paints.</p>
      </Card>

      <Card>
        <span className="card-label"><Terminal style={{ width: 12, height: 12, verticalAlign: "-2px" }}/> Deployment</span>
        <pre className="mono text-sm" style={{ margin: "12px 0 0", overflowX: "auto" }}>{`npm run doctor
npm run dev
docker compose up -d --build`}</pre>
      </Card>

      <Card className="security-card">
        <span className="card-label"><ShieldCheck style={{ width: 12, height: 12, verticalAlign: "-2px" }}/> Security</span>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
          <li>The GitHub OAuth token stays on the server inside the encrypted session cookie and is never sent to the browser.</li>
          <li>Every GitHub call is proxied through server routes with a strict Content-Security-Policy.</li>
          <li>Write operations are validated with Zod before any GitHub mutation is attempted.</li>
        </ul>
      </Card>
    </div>
  </div>;
}
