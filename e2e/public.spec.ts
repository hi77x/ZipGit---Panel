import { expect, test } from "@playwright/test";

test("unauthenticated users see OAuth landing and protected routes redirect", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/?callbackUrl=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: /From ZIP archive/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
});

test("health endpoint returns the standard safe envelope", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload).toMatchObject({ ok: true, data: { status: "healthy" }, meta: { requestId: expect.any(String) } });
  expect(JSON.stringify(payload)).not.toMatch(/secret|token|environment/i);
});

test("production security policy shape is emitted without permissive wildcards", async ({ request }) => {
  const response = await request.get("/");
  const csp = response.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toMatch(/script-src 'self' 'nonce-[a-f0-9]+'/);
  expect(csp).not.toContain("script-src *");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`landing has no document overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}
