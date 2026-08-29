import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => { await context.addCookies([{ name: "iride-locale", value: "en", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]); await page.setViewportSize({ width: 390, height: 844 }); });

test("discover renders the full map and marker filter FAB without list mode", async ({ page }) => {
  await page.goto("/"); await expect(page.locator(".maplibregl-canvas")).toBeVisible(); await expect(page.getByRole("button", { name: "List" })).toHaveCount(0); await page.getByRole("button", { name: "Filter markers" }).click();
  for (const label of ["Meeting", "Event", "Trip", "Photographer spot"]) await expect(page.getByLabel(label)).toBeVisible();
});

test("community exposes rooms and market deep links", async ({ page }) => {
  await page.goto("/community"); for (const room of ["Talk", "Market", "Photographers", "Groups"]) await expect(page.getByRole("link", { name: room, exact: true })).toBeVisible();
  await page.goto("/community?room=market&product=helmet"); await expect(page.locator("#product-helmet")).toHaveClass(/is-selected/);
});

test("theme selection survives reload", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Settings" }).click(); await page.getByRole("button", { name: "Light" }).click(); await expect(page.locator("html")).toHaveAttribute("data-theme", "light"); await page.reload(); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("legacy routes return 404", async ({ page }) => {
  for (const route of ["/profile", "/profile/edit", "/account", "/market", "/photographers/maya"]) { const response = await page.goto(route); expect(response?.status()).toBe(404); }
});

test("has no horizontal overflow at target widths", async ({ page }) => {
  for (const width of [360, 390, 768, 1280]) { await page.setViewportSize({ width, height: width < 768 ? 844 : 900 }); await page.goto("/"); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); }
});
