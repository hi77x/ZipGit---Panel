import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

const secret = "test-secret-test-secret-test-secret";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context, request }) => {
  await request.post("http://127.0.0.1:4010/__reset");
  const value = await encode({
    token: { sub: "1", githubId: "1", login: "octo", name: "Octo Test", email: "octo@example.test", picture: "https://avatars.githubusercontent.com/u/1?v=4", accessToken: "e2e-access-token" },
    secret,
    salt: "authjs.session-token",
    maxAge: 3600
  });
  await context.addCookies([{ name: "authjs.session-token", value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
});

test("authenticated repository list, README, and activity use real BFF data", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome back, octo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "demo" })).toBeVisible();
  await page.goto("/repositories/octo/demo");
  await expect(page.locator(".markdown-body h1", { hasText: "Demo" })).toBeVisible();
  await expect(page.locator(".markdown-body script")).toHaveCount(0);
  await expect(page.locator(".markdown-body img")).toHaveAttribute("src", "https://raw.githubusercontent.com/octo/demo/main/x");
  expect(await page.locator(".markdown-body img").evaluate((image) => image.hasAttribute("onerror"))).toBe(false);
  await page.goto("/repositories/octo/demo/activity");
  await expect(page.getByText("pushed 1 commit to main")).toBeVisible();
});

test("Pages disabled state enables and revalidates to building", async ({ page }) => {
  await page.goto("/repositories/octo/demo/pages");
  await expect(page.getByRole("heading", { name: "GitHub Pages is disabled" })).toBeVisible();
  await page.getByRole("button", { name: "Enable Pages" }).click();
  await expect(page.getByText("building", { exact: true })).toBeVisible();
});

test("Actions dispatch accepts GitHub 204 and run controls reflect status", async ({ page }) => {
  await page.goto("/repositories/octo/demo/actions");
  await expect(page.getByRole("link", { name: /CI/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Dispatch" }).click();
  await expect(page.getByText("Workflow dispatch accepted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Re-run" })).toBeVisible();
});

test("safe ZIP import creates one Git root commit flow", async ({ page, request }) => {
  await page.goto("/import");
  await page.locator('input[type="file"]').setInputFiles({ name: "project.zip", mimeType: "application/zip", buffer: makeZip("project/README.md", Buffer.from("# Imported\n")) });
  await page.getByLabel("Repository name").fill("imported-app");
  await page.getByRole("button", { name: "Validate and import" }).click();
  await expect(page.getByRole("heading", { name: "octo/imported-app" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("1 files were written in one root commit.")).toBeVisible();
  const state = await (await request.get("http://127.0.0.1:4010/__state")).json();
  expect(state).toMatchObject({ repositoryCreations: 1, blobCount: 1 });
});

test("unsafe ZIP is rejected before GitHub repository creation", async ({ page, request }) => {
  await page.goto("/import");
  await page.locator('input[type="file"]').setInputFiles({ name: "unsafe.zip", mimeType: "application/zip", buffer: makeZip("../evil.txt", Buffer.from("no")) });
  await page.getByLabel("Repository name").fill("must-not-exist");
  await page.getByRole("button", { name: "Validate and import" }).click();
  await expect(page.getByText(/unsafe path/i)).toBeVisible({ timeout: 20_000 });
  const state = await (await request.get("http://127.0.0.1:4010/__state")).json();
  expect(state.repositoryCreations).toBe(0);
});

test("mobile drawer traps focus and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

function makeZip(name: string, data: Buffer): Buffer {
  const filename = Buffer.from(name);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28);
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38); central.writeUInt32LE(0, 42);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12); end.writeUInt32LE(local.length + filename.length + data.length, 16);
  return Buffer.concat([local, filename, data, central, filename, end]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
