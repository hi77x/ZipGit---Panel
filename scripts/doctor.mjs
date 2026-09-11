#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

const root = process.cwd();
const required = ["AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "NEXT_PUBLIC_APP_URL"];
const placeholders = /^(local-dev|test-|build-|your-|changeme|<)/i;
let failures = 0;
let warnings = 0;

function pass(message) { console.log(`  \u2713 ${message}`); }
function warn(message) { warnings += 1; console.log(`  ! ${message}`); }
function fail(message) { failures += 1; console.log(`  \u2717 ${message}`); }

console.log("\nRepoDeck doctor\n");

const major = Number(process.versions.node.split(".")[0]);
const minor = Number(process.versions.node.split(".")[1]);
if (major > 22 || (major === 22 && minor >= 12)) pass(`Node.js ${process.versions.node}`);
else if (major === 22 || (major === 20 && minor >= 17)) warn(`Node.js ${process.versions.node} works but ${"22.12+"} is recommended`);
else fail(`Node.js ${process.versions.node} is too old. Install Node.js 22.12 or newer from https://nodejs.org`);

const envPath = [".env", ".env.local"].map((file) => join(root, file)).find((file) => existsSync(file));
if (!envPath) {
  fail("No .env or .env.local found. Run `npm run setup` or copy .env.example.");
} else {
  pass(`Environment file: ${envPath.split(/[\\/]/).pop()}`);
  const text = readFileSync(envPath, "utf8");
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match?.[1]) values.set(match[1], match[2] ?? "");
  }
  for (const name of required) {
    const value = values.get(name)?.trim() ?? "";
    if (!value) fail(`${name} is missing`);
    else if (placeholders.test(value)) warn(`${name} still looks like a placeholder`);
    else pass(`${name} is set`);
  }
  const secret = values.get("AUTH_SECRET")?.trim() ?? "";
  if (secret && secret.length < 32) fail("AUTH_SECRET must contain at least 32 characters");
}

if (!existsSync(join(root, "node_modules"))) warn("Dependencies are not installed. Run `npm install`.");
else pass("Dependencies installed");

const offline = process.argv.includes("--offline");
if (!offline) {
  try {
    const response = await fetch("https://api.github.com/rate_limit", { signal: AbortSignal.timeout(8000) });
    if (response.ok || response.status === 401) pass(`api.github.com reachable (HTTP ${response.status})`);
    else warn(`api.github.com answered HTTP ${response.status}`);
  } catch {
    fail("api.github.com is not reachable. Check network, proxy, or GITHUB_API_BASE_URL.");
  }
}

const port = Number(process.env.PORT ?? 3000);
await new Promise((resolve) => {
  const probe = createServer();
  probe.once("error", (error) => {
    if (error.code === "EADDRINUSE") warn(`Port ${port} is already in use. Stop the other process or set PORT.`);
    else warn(`Port ${port} probe failed: ${error.code}`);
    resolve();
  });
  probe.once("listening", () => { probe.close(() => { pass(`Port ${port} is free`); resolve(); }); });
  probe.listen(port, "127.0.0.1");
});

console.log(`\n${failures ? "Doctor found blocking issues." : warnings ? "Ready with warnings." : "Everything looks good."}`);
console.log("Next: npm run dev (development) or npm run docker:up (production container).\n");
process.exit(failures ? 1 : 0);
