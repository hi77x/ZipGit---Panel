import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const sizeClass: Record<Size, string> = { sm: "button-sm", md: "", lg: "button-lg", icon: "button-icon" };

export function Button({ variant = "secondary", size = "md", loading, className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return <button className={`button button-${variant} ${sizeClass[size]} ${className}`} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
    {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : null}<span>{children}</span>
  </button>;
}

export function ButtonLink({ href, variant = "secondary", size = "md", className = "", children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant; size?: Size; children: ReactNode }) {
  return <Link href={href} className={`button button-${variant} ${sizeClass[size]} ${className}`} {...props}>{children}</Link>;
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}
