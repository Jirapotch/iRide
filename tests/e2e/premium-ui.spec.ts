import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{ name: "iride-locale", value: "en", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.setViewportSize({ width: 390, height: 844 });
});

test("map-first discover supports filters, list fallback and activity detail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find your next move" })).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Trip", exact: true }).click();
  await expect(page.getByText("Bangkok to Khao Yai")).toBeVisible();
  await expect(page.getByText("Urban Motion Weekend")).toBeHidden();
  await page.getByRole("button", { name: /Bangkok to Khao Yai/ }).click();
  await expect(page.getByRole("dialog", { name: "Bangkok to Khao Yai" })).toBeVisible();
  await page.getByRole("button", { name: "Join activity" }).click();
  await page.reload();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByText("Joined")).toBeVisible();
});

test("community post, market filter, search and notification state persist", async ({ page }) => {
  await page.goto("/community");
  await page.getByPlaceholder("What is moving you today?").fill("Sunday meetup is confirmed.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Sunday meetup is confirmed.")).toBeVisible();
  await page.goto("/market");
  await page.getByRole("button", { name: "Car", exact: true }).click();
  await expect(page.getByText("4K Drive Camera")).toBeVisible();
  await expect(page.getByText("Adventure Helmet")).toBeHidden();
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByPlaceholder("Profiles, activities or products").fill("Maya");
  await expect(page.getByRole("link", { name: /Maya Velocity/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Maya roadside photo session/ })).toBeVisible();
  await page.goto("/notifications");
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.locator(".notification-row:not(.is-read)")).toHaveCount(0);
});

test("removed routes return 404", async ({ page }) => {
  for (const route of ["/garage", "/trips", "/events", "/photography", "/messages", "/explore"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
  }
});

test("has no horizontal overflow at target widths", async ({ page }) => {
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});
