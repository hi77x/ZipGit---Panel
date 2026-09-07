import { AlertTriangle, CircleOff, KeyRound, LoaderCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function EmptyState({ title, message }: { title: string; message: string }) { return <div className="state"><CircleOff aria-hidden="true"/><h3>{title}</h3><p>{message}</p></div>; }
export function ErrorState({ title = "Could not load this section", message, requestId }: { title?: string; message: string; requestId?: string }) { return <div className="state state-error" role="alert"><AlertTriangle aria-hidden="true"/><h3>{title}</h3><p>{message}</p>{requestId ? <code>Request {requestId}</code> : null}</div>; }
export function PermissionState({ message }: { message: string }) { return <div className="state"><KeyRound aria-hidden="true"/><h3>GitHub permission required</h3><p>{message}</p><ButtonLink href="/api/auth/signin" variant="primary">Reconnect GitHub</ButtonLink></div>; }
export function Spinner({ label = "Loading" }: { label?: string }) { return <span className="spinner" role="status"><LoaderCircle className="spin" aria-hidden="true"/>{label}</span>; }
export function SkeletonCards({ count = 3 }: { count?: number }) { return <div className="grid" aria-label="Loading repositories">{Array.from({ length: count }, (_, index) => <div className="card skeleton" key={index}/>)}</div>; }
