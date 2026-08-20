import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
  await page.addInitScript(() => localStorage.clear());
});

test("defaults to Thai and switches language without changing the URL", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await expect(page.getByRole("heading", { name: "ทุกการเดินทาง มีเรื่องราว" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("iride-locale"))).toBe("th");

  await page.getByRole("button", { name: "Switch to English (EN)" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Every ride has a story" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("iride-locale"))).toBe("en");
});

test("migrates a localized nested URL and preserves its query string", async ({ page }) => {
  await page.goto("/en/feed?tab=garage");

  await expect(page).toHaveURL(/\/feed\?tab=garage$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("iride-locale"))).toBe("en");
});
