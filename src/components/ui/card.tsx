import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <section className={`card ${className}`} {...props} />; }

export function Panel({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) { return <section className={`panel ${className}`} {...props}>{children}</section>; }

export function PanelHead({ title, icon, actions }: { title: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return <header className="panel-head"><h2>{icon}{title}</h2>{actions? <div className="row-actions">{actions}</div> : null}</header>;
}

export function PanelBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`panel-body ${className}`} {...props} />; }

export function PanelFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <footer className={`panel-footer ${className}`} {...props} />; }

type Tone = "neutral" | "success" | "warning" | "danger" | "accent" | "info";

export function Badge({ tone = "neutral", size = "md", children }: { tone?: Tone; size?: "md" | "lg"; children: ReactNode }) {
  return <span className={`badge badge-${tone} ${size === "lg" ? "badge-lg" : ""}`}>{children}</span>;
}

export function Metric({ label, value, icon, hint }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode }) {
  return <div className="metric"><span className="metric-label">{icon}{label}</span><span className="metric-value">{value}</span>{hint ? <span className="muted text-xs">{hint}</span> : null}</div>;
}
