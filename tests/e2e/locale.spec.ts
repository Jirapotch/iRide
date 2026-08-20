import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
  await page.addInitScript(() => localStorage.clear());
});

test("defaults to Thai and keeps language controls out of the public header", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("iride-locale"))).toBe("th");

  await expect(page.getByRole("button", { name: "Switch to English (EN)" })).toHaveCount(0);
});

test("migrates a localized nested URL and preserves its query string", async ({ page }) => {
  await page.goto("/en/feed?tab=garage");

  await expect(page).toHaveURL(/\/\?tab=garage$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("iride-locale"))).toBe("en");
});
