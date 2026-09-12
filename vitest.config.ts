import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)) } },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      exclude: ["src/test/**", "**/*.test.ts", "src/app/**", "src/components/**", "src/features/**", "src/instrumentation.ts", "src/types/**", ".next/**"],
      thresholds: {
        global: { statements: 70, branches: 55, functions: 70, lines: 72 },
        "src/lib/diff.ts": { branches: 75, lines: 90 },
        "src/lib/secret-rules.ts": { branches: 60, lines: 78 },
        "src/lib/health.ts": { branches: 65, lines: 95 },
        "src/lib/fuzzy.ts": { branches: 85, lines: 95 },
        "src/lib/logger.ts": { branches: 80, lines: 90 },
        "src/server/authz/**": { branches: 90, lines: 90 },
        "src/server/auth/**": { branches: 45, lines: 95 },
        "src/server/github/client.ts": { branches: 80, lines: 90 },
        "src/server/github/errors.ts": { branches: 65, lines: 90 },
        "src/server/import/import-service.ts": { branches: 65, lines: 90 },
        "src/server/import/import-transaction.ts": { branches: 60, lines: 80 },
        "src/server/import/secret-preflight.ts": { branches: 45, lines: 65 },
        "src/server/import/path-policy.ts": { branches: 75, lines: 90 },
        "src/server/import/git-object-writer.ts": { branches: 95, lines: 95 },
        "src/server/observability/**": { branches: 80, lines: 90 }
      }
    }
  }
});
