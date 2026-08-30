import { expect, test, type Page } from "@playwright/test";

async function openActivityCreateForm(page: Page) {
  await page.goto("/login?next=%2Fcreate%3Ftype%3Dactivity");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/create\?type=activity$/);
  await expect(page.locator("form.form-stack")).toBeVisible();
}

async function openMarkerSheet(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.route("**/api/explore?**", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "marker-1",
            kind: "meeting",
            title: "Test meeting",
            subtitle: "Bangkok ".repeat(500),
            latitude: 13.7563,
            longitude: 100.5018,
            startsAt: "2026-09-01T06:00:00.000Z",
            endsAt: null,
            author: { id: "author-1", username: "rider", displayName: "Rider" },
            canEdit: false,
          },
        ],
      }),
    }),
  );
  await page.setViewportSize(viewport);
  await page.goto("/");
  const marker = page.getByRole("button", { name: "Test meeting" });
  const documentHeightBeforeOpen = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await marker.click();
  await expect(
    page.getByRole("dialog", { name: "Test meeting" }),
  ).toBeVisible();
  return { documentHeightBeforeOpen, marker };
}

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    {
      name: "iride-locale",
      value: "en",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
});

test("discover renders the full map and marker filter FAB without list mode", async ({
  page,
}) => {
  await page.route("**/api/explore?**", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "marker-1",
            kind: "meeting",
            title: "Test meeting",
            subtitle: "Bangkok",
            latitude: 13.7563,
            longitude: 100.5018,
            startsAt: "2026-09-01T06:00:00.000Z",
            endsAt: null,
            author: { id: "author-1", username: "rider", displayName: "Rider" },
            canEdit: false,
          },
        ],
      }),
    }),
  );
  await page.goto("/");
  const map = page.getByRole("region", { name: "Discover map" });
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await expect(map).not.toHaveAttribute("data-map-raster", "true");
  await expect(canvas).toHaveCSS("filter", "none");
  await expect(page.getByRole("button", { name: "List" })).toHaveCount(0);
  await page.getByRole("button", { name: "Filter markers" }).click();
  for (const label of ["Meeting", "Event", "Trip", "Photographer spot"])
    await expect(
      page.getByRole("checkbox", { name: label, exact: true }),
    ).toBeVisible();
  const marker = page.locator(".activity-marker").first();
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS("width", "40px");
  await expect(marker).toHaveCSS("height", "48px");
  await expect(marker).toHaveCSS("clip-path", /polygon\(50% 100%/);
});

test("community exposes rooms and market deep links", async ({ page }) => {
  await page.goto("/community");
  for (const room of ["Talk", "Market", "Photographers", "Groups"])
    await expect(
      page.getByRole("link", { name: room, exact: true }),
    ).toBeVisible();
  await page.goto(
    "/community?room=market&product=00000000-0000-4000-8000-000000000001",
  );
  await expect(
    page.locator("#product-00000000-0000-4000-8000-000000000001"),
  ).toHaveClass(/is-selected/);
});

test("theme selection survives reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("map chrome follows theme without replacing the map canvas", async ({
  page,
}) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "Discover map" });
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.evaluate((element) => {
    element.dataset.mapIdentity = "initial";
  });
  await expect(map).toHaveCSS("background-color", "rgb(242, 243, 237)");
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const initialPaper = await map.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--map-paper"),
  );
  await page.getByRole("button", { name: "Settings" }).click();
  const nextTheme = initialTheme === "light" ? "dark" : "light";
  const nextThemeButton = page.getByRole("button", {
    name: nextTheme === "light" ? "Light" : "Dark",
    exact: true,
  });
  await nextThemeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
  const nextPaper = await map.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--map-paper"),
  );
  expect(nextPaper).not.toBe(initialPaper);
  await expect(map).toHaveCSS("background-color", "rgb(242, 243, 237)");
  await expect(canvas).toHaveAttribute("data-map-identity", "initial");
  await expect(canvas).toHaveCSS("filter", "none");
});

test("legacy routes return 404", async ({ page }) => {
  for (const route of [
    "/profile",
    "/profile/edit",
    "/account",
    "/market",
    "/photographers/maya",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
  }
});

test("has no horizontal overflow at target widths", async ({ page }) => {
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});

test("mobile marker detail is a scrollable viewport sheet without document growth", async ({
  page,
}) => {
  const { documentHeightBeforeOpen, marker } = await openMarkerSheet(page, {
    width: 390,
    height: 844,
  });
  const backdrop = page.locator("body > .activity-sheet-backdrop");
  const sheet = page.getByRole("dialog", { name: "Test meeting" });

  await expect(backdrop).toHaveCSS("position", "fixed");
  expect(
    await sheet.evaluate(
      (element) =>
        element.getBoundingClientRect().height <= innerHeight * 0.5 + 1,
    ),
  ).toBe(true);
  expect(
    await sheet.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await sheet.hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => sheet.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    documentHeightBeforeOpen,
  );
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  await page.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(marker).toBeFocused();

  await marker.click();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Test meeting" }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Test meeting" }).click();
  await backdrop.click({ position: { x: 5, y: 5 } });
  await expect(sheet).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Test meeting" }),
  ).toBeFocused();
});

test("desktop marker detail is pinned to the viewport bottom without document growth", async ({
  page,
}) => {
  const { documentHeightBeforeOpen } = await openMarkerSheet(page, {
    width: 1280,
    height: 900,
  });
  const sheet = page.getByRole("dialog", { name: "Test meeting" });

  expect(
    await sheet.evaluate(
      (element) =>
        Math.abs(element.getBoundingClientRect().bottom - innerHeight) < 1,
    ),
  ).toBe(true);
  expect(
    await sheet.evaluate(
      (element) =>
        element.getBoundingClientRect().height <= innerHeight * 0.5 + 1,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    documentHeightBeforeOpen,
  );
});

test("tablet marker detail clears the visible bottom navigation", async ({
  page,
}) => {
  await openMarkerSheet(page, { width: 768, height: 900 });
  const sheet = page.getByRole("dialog", { name: "Test meeting" });
  const bottomNavigation = page.locator(".mobile-nav-shell");

  await expect(bottomNavigation).toBeVisible();
  expect(
    await sheet.evaluate(
      (element, navigation) => {
        const sheetRect = element.getBoundingClientRect();
        const navigationRect = (
          navigation as HTMLElement
        ).getBoundingClientRect();
        return sheetRect.bottom <= navigationRect.top + 1;
      },
      await bottomNavigation.elementHandle(),
    ),
  ).toBe(true);
});

test("marker detail moves keyboard focus inside the dialog and traps it", async ({
  page,
}) => {
  const { marker } = await openMarkerSheet(page, { width: 390, height: 844 });
  const dialog = page.getByRole("dialog", { name: "Test meeting" });
  const close = dialog.getByRole("button", { name: "Close" });
  const author = dialog.getByRole("link", { name: "Rider" });

  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(author).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(author).toBeFocused();

  await close.click();
  await expect(marker).toBeFocused();
});

test("Google Maps import updates the form and the rendered map location", async ({
  page,
}) => {
  await openActivityCreateForm(page);

  const map = page.locator(".mini-map-preview");
  await page.getByRole("button", { name: "Import from Google Maps" }).click();
  await page
    .getByLabel("Paste a Google Maps link")
    .fill("https://www.google.com/maps/search/?api=1&query=18.788343,98.9853");
  await page.getByRole("button", { name: "Use this location" }).click();

  await expect(page.locator('input[name="latitude"]')).toHaveValue("18.788343");
  await expect(page.locator('input[name="longitude"]')).toHaveValue("98.9853");
  await expect(page.getByLabel("Latitude")).toHaveValue("18.788343");
  await expect(page.getByLabel("Longitude")).toHaveValue("98.9853");
  await expect(map).toHaveAttribute("data-camera-center", "98.9853,18.788343");
  await expect(
    map.getByRole("img", { name: "Selected location" }),
  ).toHaveAttribute("data-location", "98.9853,18.788343");
  await expect(page.getByLabel("Paste a Google Maps link")).toHaveCount(0);
  await page.getByRole("button", { name: "Import from Google Maps" }).click();
  await expect(page.getByLabel("Paste a Google Maps link")).toHaveValue("");
});

test("an invalid map URL leaves its import panel open with an error", async ({
  page,
}) => {
  await openActivityCreateForm(page);

  await page.getByRole("button", { name: "Import from Google Maps" }).click();
  await page
    .getByLabel("Paste a Google Maps link")
    .fill("https://example.com/not-a-map");
  await page.getByRole("button", { name: "Use this location" }).click();

  await expect(page.getByLabel("Paste a Google Maps link")).toBeVisible();
  await expect(
    page.getByText("This link does not contain a supported location"),
  ).toBeVisible();
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
          const gridRect = element
            .closest(".form-stack")!
            .getBoundingClientRect();
          return (
            inputRect.left >= gridRect.left && inputRect.right <= gridRect.right
          );
        }),
      ).toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});
