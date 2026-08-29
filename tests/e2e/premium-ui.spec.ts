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

test("map chrome follows theme without replacing the map canvas", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "Discover map" });
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.evaluate((element) => { element.dataset.mapIdentity = "initial"; });
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const initialPaper = await map.evaluate((element) => getComputedStyle(element).getPropertyValue("--map-paper"));
  await page.getByRole("button", { name: "Settings" }).click();
  const nextTheme = initialTheme === "light" ? "dark" : "light";
  const nextThemeButton = page.getByRole("button", { name: nextTheme === "light" ? "Light" : "Dark", exact: true });
  await nextThemeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
  const nextPaper = await map.evaluate((element) => getComputedStyle(element).getPropertyValue("--map-paper"));
  expect(nextPaper).not.toBe(initialPaper);
  await expect(canvas).toHaveAttribute("data-map-identity", "initial");
});

test("legacy routes return 404", async ({ page }) => {
  for (const route of ["/profile", "/profile/edit", "/account", "/market", "/photographers/maya"]) { const response = await page.goto(route); expect(response?.status()).toBe(404); }
});

test("has no horizontal overflow at target widths", async ({ page }) => {
  for (const width of [360, 390, 768, 1280]) { await page.setViewportSize({ width, height: width < 768 ? 844 : 900 }); await page.goto("/"); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); }
});
