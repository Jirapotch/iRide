import { expect, test, type Page } from "@playwright/test";

async function openActivityCreateForm(page: Page) {
  await page.goto("/login?next=%2Fcreate%3Ftype%3Dactivity");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/create\?type=activity$/);
  await expect(page.locator("form.form-stack")).toBeVisible();
}

test.beforeEach(async ({ context, page }) => { await context.addCookies([{ name: "iride-locale", value: "en", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]); await page.setViewportSize({ width: 390, height: 844 }); });

test("discover renders the full map and marker filter FAB without list mode", async ({ page }) => {
  await page.route("**/api/explore?**", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [{ id: "marker-1", kind: "meeting", title: "Test meeting", subtitle: "Bangkok", latitude: 13.7563, longitude: 100.5018, startsAt: "2026-09-01T06:00:00.000Z", endsAt: null, author: { id: "author-1", username: "rider", displayName: "Rider" }, canEdit: false }] }) }));
  await page.goto("/"); const map = page.getByRole("region", { name: "Discover map" }); const canvas = page.locator(".maplibregl-canvas"); await expect(canvas).toBeVisible(); await expect(map).not.toHaveAttribute("data-map-raster", "true"); await expect(canvas).toHaveCSS("filter", "none"); await expect(page.getByRole("button", { name: "List" })).toHaveCount(0); await page.getByRole("button", { name: "Filter markers" }).click();
  for (const label of ["Meeting", "Event", "Trip", "Photographer spot"]) await expect(page.getByRole("checkbox", { name: label, exact: true })).toBeVisible();
  const marker = page.locator(".activity-marker").first();
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS("width", "40px");
  await expect(marker).toHaveCSS("height", "48px");
  await expect(marker).toHaveCSS("clip-path", /polygon\(50% 100%/);
});

test("community exposes rooms and market deep links", async ({ page }) => {
  await page.goto("/community"); for (const room of ["Talk", "Market", "Photographers", "Groups"]) await expect(page.getByRole("link", { name: room, exact: true })).toBeVisible();
  await page.goto("/community?room=market&product=00000000-0000-4000-8000-000000000001"); await expect(page.locator("#product-00000000-0000-4000-8000-000000000001")).toHaveClass(/is-selected/);
});

test("theme selection survives reload", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Settings" }).click(); await page.getByRole("button", { name: "Light" }).click(); await expect(page.locator("html")).toHaveAttribute("data-theme", "light"); await page.reload(); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("map chrome follows theme without replacing the map canvas", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "Discover map" });
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.evaluate((element) => { element.dataset.mapIdentity = "initial"; });
  await expect(map).toHaveCSS("background-color", "rgb(242, 243, 237)");
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const initialPaper = await map.evaluate((element) => getComputedStyle(element).getPropertyValue("--map-paper"));
  await page.getByRole("button", { name: "Settings" }).click();
  const nextTheme = initialTheme === "light" ? "dark" : "light";
  const nextThemeButton = page.getByRole("button", { name: nextTheme === "light" ? "Light" : "Dark", exact: true });
  await nextThemeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
  const nextPaper = await map.evaluate((element) => getComputedStyle(element).getPropertyValue("--map-paper"));
  expect(nextPaper).not.toBe(initialPaper);
  await expect(map).toHaveCSS("background-color", "rgb(242, 243, 237)");
  await expect(canvas).toHaveAttribute("data-map-identity", "initial");
  await expect(canvas).toHaveCSS("filter", "none");
});

test("legacy routes return 404", async ({ page }) => {
  for (const route of ["/profile", "/profile/edit", "/account", "/market", "/photographers/maya"]) { const response = await page.goto(route); expect(response?.status()).toBe(404); }
});

test("has no horizontal overflow at target widths", async ({ page }) => {
  for (const width of [360, 390, 768, 1280]) { await page.setViewportSize({ width, height: width < 768 ? 844 : 900 }); await page.goto("/"); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); }
});

test("Google Maps import updates the form and the rendered map location", async ({
  page,
}) => {
  await openActivityCreateForm(page);

  const map = page.locator(".mini-map-preview");
  await page
    .getByRole("button", { name: "Import from Google Maps" })
    .click();
  await page
    .getByLabel("Paste a Google Maps link")
    .fill("https://www.google.com/maps/search/?api=1&query=18.788343,98.9853");
  await page.getByRole("button", { name: "Use this location" }).click();

  await expect(page.locator('input[name="latitude"]')).toHaveValue("18.788343");
  await expect(page.locator('input[name="longitude"]')).toHaveValue("98.9853");
  await expect(page.getByLabel("Latitude")).toHaveValue("18.788343");
  await expect(page.getByLabel("Longitude")).toHaveValue("98.9853");
  await expect(map).toHaveAttribute("data-camera-center", "98.9853,18.788343");
  await expect(map.getByRole("img", { name: "Selected location" })).toHaveAttribute(
    "data-location",
    "98.9853,18.788343",
  );
  await expect(page.getByLabel("Paste a Google Maps link")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Import from Google Maps" })
    .click();
  await expect(page.getByLabel("Paste a Google Maps link")).toHaveValue("");
});

test("an invalid map URL leaves its import panel open with an error", async ({
  page,
}) => {
  await openActivityCreateForm(page);

  await page
    .getByRole("button", { name: "Import from Google Maps" })
    .click();
  await page
    .getByLabel("Paste a Google Maps link")
    .fill("https://example.com/not-a-map");
  await page.getByRole("button", { name: "Use this location" }).click();

  await expect(page.getByLabel("Paste a Google Maps link")).toBeVisible();
  await expect(page.getByText("This link does not contain a supported location")).toBeVisible();
});

test("activity datetime fields stay within their grid at target viewport widths", async ({
  page,
}) => {
  await openActivityCreateForm(page);

  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const name of ["startsAt", "endsAt"]) {
      const input = page.locator(`input[name="${name}"]`);
      expect(
        await input.evaluate((element) => {
          const inputRect = element.getBoundingClientRect();
          const gridRect = element.closest(".form-stack")!.getBoundingClientRect();
          return inputRect.left >= gridRect.left && inputRect.right <= gridRect.right;
        }),
      ).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});
