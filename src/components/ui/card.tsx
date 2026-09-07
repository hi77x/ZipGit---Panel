import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <section className={`card ${className}`} {...props} />; }
export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "accent"; children: ReactNode }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
