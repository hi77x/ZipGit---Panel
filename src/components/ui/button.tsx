import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ variant = "secondary", loading, className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return <button className={`button button-${variant} ${className}`} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
    {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : null}<span>{children}</span>
  </button>;
}

export function ButtonLink({ href, variant = "secondary", className = "", children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant; children: ReactNode }) {
  return <Link href={href} className={`button button-${variant} ${className}`} {...props}>{children}</Link>;
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}
