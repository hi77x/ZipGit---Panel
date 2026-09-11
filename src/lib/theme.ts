export type ThemePreference = "dark" | "light" | "system";
const storageKey = "repodeck-theme";

export function resolveTheme(preference: ThemePreference): "dark" | "light" {
  if (preference === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    return "dark";
  }
  return preference;
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const value = window.localStorage.getItem(storageKey);
  return value === "light" || value === "system" ? value : "dark";
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveTheme(preference);
}

export function saveThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, preference);
  applyTheme(preference);
  for (const listener of themeListeners) listener();
}

export const themeInitScript = `(function(){try{var v=localStorage.getItem("${storageKey}");var t=(v==="light"||v==="system")?v:"dark";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):t;document.documentElement.dataset.theme=r;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

const themeListeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  const onStorage = () => listener();
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function readThemePreferenceSnapshot(): ThemePreference {
  return readThemePreference();
}

export function serverThemeSnapshot(): ThemePreference {
  return "dark";
}

