import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.env.CI ? {} : { channel: "msedge" as const }) } }],
  webServer: [
    { command: "node e2e/mock-github.mjs", url: "http://127.0.0.1:4010/__health", reuseExistingServer: !process.env.CI },
    {
      command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI,
      env: {
        AUTH_SECRET: "test-secret-test-secret-test-secret",
        AUTH_GITHUB_ID: "test-client",
        AUTH_GITHUB_SECRET: "test-client-secret",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
        GITHUB_API_BASE_URL: "http://127.0.0.1:4010"
      }
    }
  ]
});
