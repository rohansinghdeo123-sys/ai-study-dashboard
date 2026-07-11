import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = [
  { path: "/login", heading: /your personal ai agent/i },
  { path: "/terms", heading: "Terms of Service" },
  { path: "/privacy", heading: "Privacy Policy" },
] as const;

const protectedRoutes = [
  "/dashboard",
  "/dashboard/study",
  "/dashboard/exam",
  "/dashboard/progress",
  "/dashboard/mission",
  "/analytics",
  "/onboarding",
  "/dashboard/admin",
  "/dashboard/internal/admin",
  "/dashboard/internal/ops",
] as const;

async function gotoAppRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
  }));

  expect(overflow.documentOverflow).toBeLessThanOrEqual(1);
  expect(overflow.bodyOverflow).toBeLessThanOrEqual(1);
}

async function expectLoginReady(page: Page) {
  await expect(page.getByRole("heading", { name: /your personal ai agent/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
}

test.describe("public routes", () => {
  for (const route of publicRoutes) {
    test(`${route.path} renders on desktop and mobile without layout overflow`, async ({ page }) => {
      await gotoAppRoute(page, route.path);

      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("login terms link reaches Terms", async ({ page }) => {
    await gotoAppRoute(page, "/login");
    await expectLoginReady(page);

    const termsLink = page.getByRole("link", { name: "Terms" });
    await expect(termsLink).toHaveAttribute("href", "/terms");
    await termsLink.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL(/\/terms$/, { timeout: 15_000 }),
      termsLink.click(),
    ]);
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  });

  test("login privacy link reaches Privacy Policy", async ({ page }) => {
    await gotoAppRoute(page, "/login");
    await expectLoginReady(page);

    const privacyLink = page.getByRole("link", { name: "Privacy Policy" });
    await expect(privacyLink).toHaveAttribute("href", "/privacy");
    await privacyLink.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL(/\/privacy$/, { timeout: 15_000 }),
      privacyLink.click(),
    ]);
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });

  test("theme toggle applies dark and light theme states", async ({ page }) => {
    await gotoAppRoute(page, "/login");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: /switch to dark theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: /switch to light theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("critical public pages have no critical axe violations", async ({ page }) => {
    for (const route of publicRoutes) {
      await gotoAppRoute(page, route.path);
      await page.getByRole("heading", { name: route.heading }).waitFor();

      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .analyze();
      const criticalViolations = results.violations.filter(
        (violation) => violation.impact === "critical",
      );

      expect(criticalViolations, `${route.path} critical axe violations`).toEqual([]);
    }
  });
});

test.describe("protected routes", () => {
  test("/admin shortcut does not expose the founder console unauthenticated", async ({ page }) => {
    await gotoAppRoute(page, "/admin");
    await page.waitForURL(/\/(admin|dashboard\/internal\/admin|login)$/, { timeout: 15_000 });

    await expect(page.getByText(/AGENTIFYOPS/i)).toHaveCount(0);
    await expect(page.getByText(/Model traces/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  for (const route of protectedRoutes) {
    test(`${route} keeps unauthenticated students out of private UI`, async ({ page }) => {
      await gotoAppRoute(page, route);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: /your personal ai agent/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
      await expect(page.getByText(/private study content/i)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  }
});
