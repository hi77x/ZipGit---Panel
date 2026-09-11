import Image from "next/image";
import { CalendarDays, Files, FileText, Gauge, GitCommitHorizontal, HardDrive, Languages, Lightbulb, ListChecks, Package, Radar, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { BarList, Heatmap, LanguageBreakdown, ScoreGauge } from "@/components/charts";
import { Badge, Metric, Panel, PanelBody, PanelHead } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { HealthChecks } from "@/features/radar/health-checks";
import { SecretFindings } from "@/features/radar/secret-findings";
import { formatBytes, formatDateTime, formatNumber, initials } from "@/lib/format";
import type { AuditReportDto } from "@/shared/contracts/audit";

type RadarReport = AuditReportDto & { textFiles: number };

export function RadarView({ report, owner, repo, gitRef }: { report: RadarReport; owner: string; repo: string; gitRef: string | null }) {
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/radar`;
  const rescanHref = gitRef ? `${base}?ref=${encodeURIComponent(gitRef)}` : base;
  const commitsLast90Days = report.activity.slice(-90).reduce((total, day) => total + day.count, 0);
  const passing = report.health.checks.filter((check) => check.status === "pass").length;
  return <div className="feature-stack">
    <header className="section-heading">
      <div>
        <span className="eyebrow"><Radar/> Repository audit</span>
        <h2>Repository radar</h2>
        <p>Generated {formatDateTime(report.generatedAt)} for <code>{gitRef ?? report.checks.defaultBranch}</code>. {report.checks.archived ? "This repository is archived, so health scoring is paused." : "Health, secret, language, contributor, and dependency signals from the current tree."}</p>
      </div>
      <ButtonLink href={rescanHref} variant="primary"><RefreshCw/> Rescan</ButtonLink>
    </header>

    {report.truncated ? <div className="inline-warning">This audit was truncated by GitHub tree limits, the 400-file or 4 MB download budget, or the 365-day commit window. Counts reflect the data that could be sampled.</div> : null}

    <div className="insights-grid">
      <div className="metric-grid">
        <Metric label="Files scanned" value={formatNumber(report.fileCount)} icon={<Files/>} hint="blobs in the current tree"/>
        <Metric label="Total size" value={formatBytes(report.totalBytes)} icon={<HardDrive/>} hint="tree content at this ref"/>
        <Metric label="Text files downloaded" value={formatNumber(report.textFiles)} icon={<FileText/>} hint="within the audit budget"/>
        <Metric label="Contributors" value={formatNumber(report.contributors.length)} icon={<Users/>} hint="top 12 by commits"/>
        <Metric label="Commits (90 days)" value={formatNumber(commitsLast90Days)} icon={<GitCommitHorizontal/>} hint={`${formatNumber(report.commitsScanned)} scanned this year`}/>
        <Metric label="Secret findings" value={formatNumber(report.secrets.summary.total)} icon={<ShieldAlert/>} hint={report.secrets.summary.total ? `${report.secrets.summary.affectedFiles} affected file${report.secrets.summary.affectedFiles === 1 ? "" : "s"}` : "no exposed credentials found"}/>
      </div>
      <Panel>
        <PanelHead title="Health score" icon={<Gauge/>} actions={<Badge tone={report.health.score >= 85 ? "success" : report.health.score >= 60 ? "warning" : "danger"}>{report.health.grade}</Badge>}/>
        <PanelBody>
          <ScoreGauge score={report.health.score} grade={report.health.grade}/>
          <p className="muted text-sm" style={{ margin: "12px 0 0", textAlign: "center" }}>{report.health.summary}</p>
        </PanelBody>
      </Panel>
    </div>

    <Panel>
      <PanelHead title="Health checks" icon={<ListChecks/>} actions={<span className="muted text-xs">{passing} of {report.health.checks.length} passing</span>}/>
      <PanelBody><HealthChecks checks={report.health.checks}/></PanelBody>
    </Panel>

    <SecretFindings findings={report.secrets.findings} summary={report.secrets.summary}/>

    <div className="grid-2">
      <Panel>
        <PanelHead title="Language composition" icon={<Languages/>} actions={<span className="muted text-xs">top {Math.min(8, report.languages.length)}</span>}/>
        <PanelBody>
          {report.languages.length ? <>
            <LanguageBreakdown languages={report.languages} limit={7}/>
            <div style={{ marginTop: 16 }}>
              <BarList items={report.languages.slice(0, 8).map((language) => ({ label: language.name, value: language.bytes, percent: language.percent, color: language.color, hint: formatBytes(language.bytes) }))}/>
            </div>
          </> : <p className="muted text-sm">No language data is available for this tree.</p>}
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHead title="Contributors" icon={<Users/>} actions={<span className="muted text-xs">{report.contributors.length} listed</span>}/>
        <PanelBody>
          {report.contributors.length ? <div className="stack-sm">{report.contributors.map((contributor) => (
            <div className="bar-row" key={contributor.login} style={{ gridTemplateColumns: "auto minmax(0, 140px) 1fr auto" }}>
              {contributor.avatarUrl ? <Image src={contributor.avatarUrl} alt="" width={26} height={26} style={{ borderRadius: "50%" }}/> : <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", fontSize: ".68rem", fontWeight: 700 }}>{initials(contributor.login)}</span>}
              <span className="truncate" title={contributor.login}>{contributor.login}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(2, contributor.percent)}%` }}/></span>
              <span className="bar-value">{formatNumber(contributor.commits)}</span>
            </div>
          ))}</div> : <p className="muted text-sm">No contributor data is available.</p>}
        </PanelBody>
      </Panel>
    </div>

    <div className="grid-2">
      <Panel>
        <PanelHead title="Commit activity" icon={<CalendarDays/>} actions={<span className="muted text-xs">{formatNumber(commitsLast90Days)} in the last 90 days</span>}/>
        <PanelBody><Heatmap days={report.activity} label="commits"/></PanelBody>
      </Panel>
      <Panel>
        <PanelHead title="Dependency manifests" icon={<Package/>} actions={<span className="muted text-xs">{report.manifests.length} detected</span>}/>
        <PanelBody>
          {report.manifests.length ? <div className="stack-sm">{report.manifests.map((manifest) => (
            <div key={manifest.path} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              <div className="spread">
                <div className="cluster">
                  <Badge tone="accent">{manifest.ecosystem}</Badge>
                  <strong>{manifest.label}</strong>
                  <span className="muted text-xs mono truncate">{manifest.path}</span>
                </div>
                <div className="cluster">
                  <span className="label-chip">{formatNumber(manifest.runtime)} runtime</span>
                  <span className="label-chip">{formatNumber(manifest.development)} dev</span>
                </div>
              </div>
              {manifest.sample.length ? <div className="cluster" style={{ marginTop: 8 }}>{manifest.sample.map((item) => <span className="tag" key={item}>{item}</span>)}</div> : null}
            </div>
          ))}</div> : <p className="muted text-sm">No dependency manifests were detected in the downloaded files.</p>}
        </PanelBody>
      </Panel>
    </div>

    <Panel>
      <PanelHead title="Recommendations" icon={<Lightbulb/>} actions={<span className="muted text-xs">{report.recommendations.length} actions</span>}/>
      <PanelBody>
        {report.recommendations.length ? <div className="stack-sm">{report.recommendations.map((recommendation) => (
          <div key={recommendation.id} className="card" style={{ padding: 14 }}>
            <div className="spread">
              <strong>{recommendation.title}</strong>
              <Badge tone={recommendation.severity === "high" ? "danger" : recommendation.severity === "medium" ? "warning" : "info"}>{recommendation.severity}</Badge>
            </div>
            <p className="muted text-sm" style={{ margin: "6px 0 0" }}>{recommendation.detail}</p>
          </div>
        ))}</div> : <p className="muted text-sm">No recommendations. This repository passes every check the radar could run.</p>}
      </PanelBody>
    </Panel>
  </div>;
}
