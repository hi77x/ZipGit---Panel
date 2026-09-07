import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)) } },
  test: { environment: "node", setupFiles: ["./src/test/setup.ts"], exclude: ["e2e/**", "node_modules/**"], coverage: { reporter: ["text", "html"] } }
});
