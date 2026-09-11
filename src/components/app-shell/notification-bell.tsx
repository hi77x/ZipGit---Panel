"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/github/notifications?perPage=1", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { ok: boolean; data?: { unreadCount: number } };
        if (!cancelled && payload.ok && payload.data) setCount(payload.data.unreadCount);
      } catch { /* notifications endpoint is optional */ }
    })();
    return () => { cancelled = true; };
  }, []);
  return <button type="button" className="icon-button" onClick={() => router.push("/notifications")} aria-label={count ? `${count} unread notifications` : "Notifications"} title="Notifications">
    <Bell/>{count ? <span className="dot"/> : null}
  </button>;
}
