import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/card";
import type { HealthCheck } from "@/lib/health";

const tones = { pass: "success", warn: "warning", fail: "danger" } as const;

export function HealthChecks({ checks }: { checks: HealthCheck[] }) {
  if (!checks.length) return <p className="muted text-sm">Health scoring is paused for archived repositories.</p>;
  return <div>{checks.map((check) => {
    const Icon = check.status === "pass" ? CircleCheck : check.status === "warn" ? TriangleAlert : CircleX;
    return <div className={`check-item check-${check.status}`} key={check.id}>
      <Icon aria-hidden="true"/>
      <div style={{ flex: 1 }}>
        <strong>{check.label}</strong>
        <p>{check.detail}</p>
      </div>
      <Badge tone={tones[check.status]}>{check.earned}/{check.weight}</Badge>
    </div>;
  })}</div>;
}
