"use client";
import { useEffect, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";

export function StarButton({ owner, repo, initialStars }: { owner: string; repo: string; initialStars: number }) {
  const [starred, setStarred] = useState<boolean | null>(null);
  const [stars, setStars] = useState(initialStars);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await apiRequest<{ starred: boolean; stars: number }>(`/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/star`);
        if (!cancelled) { setStarred(result.starred); setStars(result.stars); }
      } catch { /* star state stays unknown */ }
    })();
    return () => { cancelled = true; };
  }, [owner, repo]);

  function toggle() {
    startTransition(async () => {
      try {
        const next = !(starred ?? false);
        const result = await apiRequest<{ starred: boolean; stars: number }>(`/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/star`, { method: next ? "PUT" : "DELETE" });
        setStarred(result.starred);
        setStars(result.stars);
        toast(result.starred ? "Repository starred" : "Star removed", "success");
      } catch {
        toast("Could not update the star. Check repository permissions.", "error");
      }
    });
  }

  const active = starred ?? false;
  return <button type="button" className={`button ${active ? "button-primary" : ""}`} onClick={toggle} disabled={pending} aria-pressed={active} title={active ? "Remove star" : "Star repository"}>
    <Star style={active ? { fill: "currentColor" } : undefined}/>{stars}
  </button>;
}
