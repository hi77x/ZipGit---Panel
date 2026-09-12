import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

const secret = "test-secret-test-secret-test-secret";

async function authenticate(context: BrowserContext): Promise<void> {
  const value = await encode({
    token: { sub: "1", githubId: "1", login: "octo", name: "Octo Test", email: "octo@example.test", picture: "https://avatars.githubusercontent.com/u/1?v=4", accessToken: "e2e-access-token" },
    secret,
    salt: "authjs.session-token",
    maxAge: 3600
  });
  await context.addCookies([{ name: "authjs.session-token", value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

async function expectNoCriticalViolations(page: import("@playwright/test").Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const critical = results.violations.filter((violation) => violation.impact === "critical");
  expect(critical, `${label}: ${JSON.stringify(critical.map((violation) => ({ id: violation.id, nodes: violation.nodes.length })), null, 2)}`).toEqual([]);
}

test("landing has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expectNoCriticalViolations(page, "landing");
});

test.describe("authenticated surfaces", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("dashboard, repositories, and import have no critical accessibility violations", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expectNoCriticalViolations(page, "dashboard");

    await page.goto("/repositories");
    await expectNoCriticalViolations(page, "repositories");

    await page.goto("/import");
    await expect(page.getByText("Choose archive")).toBeVisible();
    await expectNoCriticalViolations(page, "import");
  });

  test("command palette is keyboard operable", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("heading", { name: /Welcome back/ }).waitFor();
    await page.getByRole("button", { name: "Open command palette" }).waitFor();
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
