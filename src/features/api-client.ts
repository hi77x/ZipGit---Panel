import type { ApiResponse } from "@/shared/contracts/api-error";

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const payload = await response.json() as ApiResponse<T>;
  if (!payload.ok) throw Object.assign(new Error(payload.error.message), payload.error);
  return payload.data;
}
