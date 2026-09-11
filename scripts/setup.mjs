#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const target = join(root, ".env");
const example = join(root, ".env.example");

if (existsSync(target)) {
  console.log(".env already exists. Nothing was overwritten.");
} else {
  if (!existsSync(example)) {
    console.error(".env.example is missing. Restore it from the repository and run setup again.");
    process.exit(1);
  }
  copyFileSync(example, target);
  console.log("Created .env from .env.example");
}

const current = readFileSync(target, "utf8");
const secretPattern = /^AUTH_SECRET=.*$/m;
const secret = randomBytes(32).toString("base64url");
if (secretPattern.test(current) && !/^AUTH_SECRET=.*\S.*$/m.test(current)) {
  writeFileSync(target, current.replace(secretPattern, `AUTH_SECRET=${secret}`));
  console.log("Generated AUTH_SECRET (32 bytes, base64url)");
} else if (secretPattern.test(current)) {
  const existing = /^AUTH_SECRET=(.*)$/m.exec(current)?.[1]?.trim() ?? "";
  if (existing.length < 32) {
    writeFileSync(target, current.replace(secretPattern, `AUTH_SECRET=${secret}`));
    console.log("Replaced a short AUTH_SECRET with a generated one");
  } else {
    console.log("AUTH_SECRET already present");
  }
} else {
  writeFileSync(target, `${current.trimEnd()}\nAUTH_SECRET=${secret}\n`);
  console.log("Appended AUTH_SECRET");
}

console.log(`
Next steps
1. Create a GitHub OAuth App at https://github.com/settings/developers
   - Homepage URL:              http://localhost:3000
   - Authorization callback:    http://localhost:3000/api/auth/callback/github
2. Put the client ID and secret into .env:
   AUTH_GITHUB_ID=...
   AUTH_GITHUB_SECRET=...
3. Validate your environment with: npm run doctor
4. Start RepoDeck with:           npm run dev

Production: set a real NEXT_PUBLIC_APP_URL and run: npm run docker:up
`);
