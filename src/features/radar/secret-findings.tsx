"use client";
import { useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge, Panel, PanelBody, PanelHead } from "@/components/ui/card";
import type { SecretFinding, SecretSeverity } from "@/lib/secret-rules";

type SecretSummary = { total: number; bySeverity: Record<SecretSeverity, number>; riskScore: number; affectedFiles: number };
type Tone = "danger" | "warning" | "accent" | "info" | "neutral";
const severityOrder: SecretSeverity[] = ["critical", "high", "medium", "low", "info"];
const severityTone: Record<SecretSeverity, Tone> = { critical: "danger", high: "warning", medium: "accent", low: "info", info: "neutral" };

export function SecretFindings({ findings, summary }: { findings: SecretFinding[]; summary: SecretSummary }) {
  const [severity, setSeverity] = useState<SecretSeverity | "all">("all");
  const visible = useMemo(() => (severity === "all" ? findings : findings.filter((finding) => finding.severity === severity)), [findings, severity]);
  if (!summary.total) {
    return <Panel>
      <PanelHead title="Secret findings" icon={<ShieldCheck/>}/>
      <PanelBody>
        <div className="state"><ShieldCheck style={{ color: "var(--success)" }} aria-hidden="true"/><h3>No secrets detected</h3><p>The scanner reviewed every text file it downloaded and found no exposed credentials.</p></div>
      </PanelBody>
    </Panel>;
  }
  return <Panel>
    <PanelHead title="Secret findings" icon={<ShieldAlert/>} actions={<span className="muted text-xs">{summary.total} finding{summary.total === 1 ? "" : "s"} · {summary.affectedFiles} file{summary.affectedFiles === 1 ? "" : "s"} · risk {summary.riskScore}/100</span>}/>
    <PanelBody className="stack-sm">
      <div className="filter-chips" role="group" aria-label="Filter findings by severity">
        <button type="button" className={severity === "all" ? "chip-active" : ""} onClick={() => setSeverity("all")}>All {summary.total}</button>
        {severityOrder.map((item) => {
          const count = summary.bySeverity[item];
          return count ? <button type="button" key={item} className={severity === item ? "chip-active" : ""} onClick={() => setSeverity(item)}>{item.charAt(0).toUpperCase()}{item.slice(1)} {count}</button> : null;
        })}
      </div>
      {visible.map((finding) => <FindingCard key={finding.id} finding={finding}/>)}
      {visible.length ? null : <p className="muted text-sm">No findings at this severity.</p>}
    </PanelBody>
  </Panel>;
}

function FindingCard({ finding }: { finding: SecretFinding }) {
  const highlight = finding.snippet.indexOf(finding.masked);
  return <article className={`finding finding-${finding.severity}`}>
    <div className="finding-head">
      <Badge tone={severityTone[finding.severity]}>{finding.severity}</Badge>
      <span className="finding-title">{finding.name}</span>
      <span className="muted text-xs mono truncate" title={`${finding.path}:${finding.line}`}>{finding.path}:{finding.line}</span>
    </div>
    <p className="muted text-sm" style={{ margin: 0, padding: "0 13px 10px" }}>{finding.description}</p>
    <pre className="finding-snippet">{highlight < 0 ? finding.snippet : <>{finding.snippet.slice(0, highlight)}<mark className="mark-line">{finding.masked}</mark>{finding.snippet.slice(highlight + finding.masked.length)}</>}</pre>
    <p className="muted text-sm" style={{ margin: 0, padding: "10px 13px" }}><code>{finding.masked}</code> — {finding.remediation}</p>
  </article>;
}
