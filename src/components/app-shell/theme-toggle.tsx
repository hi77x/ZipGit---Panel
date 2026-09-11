"use client";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { readThemePreferenceSnapshot, resolveTheme, saveThemePreference, serverThemeSnapshot, subscribeTheme, type ThemePreference } from "@/lib/theme";

const order: ThemePreference[] = ["dark", "light", "system"];

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribeTheme, readThemePreferenceSnapshot, serverThemeSnapshot);

  function cycle() {
    const next = order[(order.indexOf(preference) + 1) % order.length] ?? "dark";
    saveThemePreference(next);
  }

  const resolved = resolveTheme(preference);
  const Icon = preference === "system" ? Monitor : resolved === "light" ? Sun : Moon;
  const label = preference === "system" ? "System theme" : resolved === "light" ? "Light theme" : "Dark theme";
  return <button type="button" className="icon-button" onClick={cycle} title={`${label} — click to switch`} aria-label={label}><Icon/></button>;
}
