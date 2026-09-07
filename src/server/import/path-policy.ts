import { posix } from "node:path";
import { AppError } from "@/shared/contracts/api-error";
import { GENERATED_PATTERNS, IMPORT_MAX_PATH_DEPTH, IMPORT_MAX_PATH_LENGTH } from "./constants";

const drivePattern = /^[A-Za-z]:[\\/]/;
const secretNames = [
  /^\.env(?:\..+)?$/i, /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/i, /\.(?:pem|p12|pfx|key)$/i,
  /(?:^|[-_.])(credentials?|secrets?)(?:[-_.]|$)/i, /service[-_.]?account.*\.json$/i
];

export function normalizeZipPath(raw: string): string {
  if (!raw || raw.includes("\0") || raw.startsWith("/") || raw.startsWith("\\") || drivePattern.test(raw)) unsafe(raw);
  const slashed = raw.replace(/\\/g, "/");
  const parts = slashed.split("/");
  if (parts.some((part) => part === "..")) unsafe(raw);
  const normalized = posix.normalize(slashed).replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) unsafe(raw);
  if (normalized.split("/").length > IMPORT_MAX_PATH_DEPTH) unsafe(raw);
  if (normalized.length > IMPORT_MAX_PATH_LENGTH) throw new AppError("PATH_TOO_LONG", `Archive path is longer than ${IMPORT_MAX_PATH_LENGTH} characters.`, 400);
  return normalized;
}

export function isForbiddenGitPath(path: string): boolean {
  return path.split("/").some((part) => part.toLowerCase() === ".git");
}

export function isPotentialSecret(path: string): boolean {
  const name = path.split("/").at(-1) ?? path;
  if (/^\.env\.example$/i.test(name)) return false;
  return secretNames.some((pattern) => pattern.test(name));
}

export function generatedReason(path: string): string | null {
  const parts = path.split("/");
  const folder = parts.find((part) => GENERATED_PATTERNS.includes(part as (typeof GENERATED_PATTERNS)[number]));
  if (folder) return `${folder}/ excluded`;
  const name = parts.at(-1) ?? "";
  if (/\.log$/i.test(name) || name === ".DS_Store" || name.toLowerCase() === "thumbs.db") return "generated file excluded";
  return null;
}

export function assertNoCollisions(paths: string[]): void {
  const exact = new Set<string>();
  const folded = new Map<string, string>();
  for (const path of paths) {
    if (exact.has(path)) throw collision(path);
    const lower = path.toLocaleLowerCase("en-US");
    const previous = folded.get(lower);
    if (previous && previous !== path) throw collision(`${previous} / ${path}`);
    exact.add(path);
    folded.set(lower, path);
  }
}

export function stripSingleRoot(paths: string[]): { paths: string[]; detected: boolean } {
  if (!paths.length || paths.some((path) => !path.includes("/"))) return { paths, detected: false };
  const root = paths[0]?.split("/")[0];
  if (!root || paths.some((path) => path.split("/")[0] !== root)) return { paths, detected: false };
  const stripped = paths.map((path) => path.slice(root.length + 1));
  if (stripped.some((path) => !path)) return { paths, detected: false };
  assertNoCollisions(stripped);
  return { paths: stripped, detected: true };
}

function unsafe(path: string): never {
  throw new AppError("UNSAFE_ZIP_PATH", `Unsafe archive path: ${safePath(path)}`, 400);
}

function collision(path: string) {
  return new AppError("ZIP_PATH_COLLISION", `Archive contains colliding paths: ${safePath(path)}`, 400);
}

export function safePath(path: string): string {
  return path.replace(/[\x00-\x1f\x7f]/g, "�").slice(0, 240);
}
