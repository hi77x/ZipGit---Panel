const segmentPattern = /^[A-Za-z0-9_.-]+$/;

export function encodeGitHubSegment(value: string, label = "path segment"): string {
  const normalized = value.trim();
  if (!normalized || normalized === "." || normalized === ".." || !segmentPattern.test(normalized)) {
    throw new Error(`Invalid ${label}`);
  }
  return encodeURIComponent(normalized);
}

export function safeCallbackUrl(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "http://local.invalid");
    return parsed.origin === "http://local.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function isSafeGitHubRef(ref: string): boolean {
  return Boolean(ref) && ref.length <= 255 && !/[\x00-\x20~^:?*[\\]/.test(ref) &&
    !ref.includes("..") && !ref.includes("@{") && !ref.endsWith("/") && !ref.startsWith("/") &&
    !ref.endsWith(".") && !ref.endsWith(".lock");
}
