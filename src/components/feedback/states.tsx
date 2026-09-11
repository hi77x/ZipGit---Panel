import { AlertTriangle, CircleOff, KeyRound, LoaderCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return <div className="state"><CircleOff aria-hidden="true"/><h3>{title}</h3><p>{message}</p>{action}</div>;
}

export function ErrorState({ title = "Could not load this section", message, requestId }: { title?: string; message: string; requestId?: string }) {
  return <div className="state state-error" role="alert"><AlertTriangle aria-hidden="true"/><h3>{title}</h3><p>{message}</p>{requestId ? <code className="text-xs">Request {requestId}</code> : null}</div>;
}

export function PermissionState({ message, title = "GitHub permission required" }: { message: string; title?: string }) {
  return <div className="state"><KeyRound aria-hidden="true"/><h3>{title}</h3><p>{message}</p><ButtonLink href="/api/auth/signin" variant="primary">Reconnect GitHub</ButtonLink></div>;
}

export function Spinner({ label = "Loading" }: { label?: string }) { return <span className="spinner" role="status"><LoaderCircle className="spin" aria-hidden="true"/>{label}</span>; }

export function SkeletonCards({ count = 3 }: { count?: number }) { return <div className="grid" aria-label="Loading"><div className="skeleton skeleton-card"/>{Array.from({ length: count - 1 }, (_, index) => <div className="skeleton skeleton-card" key={index}/>)}</div>; }

export function SkeletonRows({ count = 6 }: { count?: number }) {
  return <div className="panel panel-body stack-sm" aria-label="Loading">{Array.from({ length: count }, (_, index) => <div className="skeleton skeleton-line" key={index}/>)}</div>;
}
