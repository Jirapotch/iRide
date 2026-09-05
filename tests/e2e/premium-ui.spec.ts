import { expect, test, type Page } from "@playwright/test";

async function openActivityCreateForm(page: Page) {
  await page.goto("/login?next=%2Fcreate%3Ftype%3Dactivity");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/create\?type=activity$/);
  await expect(page.locator("form.form-stack")).toBeVisible();
}

async function createOwnerActivity(page: Page) {
  await openActivityCreateForm(page);
  await page.getByLabel("Title").fill("Owner meeting");
  await page.getByLabel("Location name").fill("Bangkok");
  await page.getByLabel("Starts").fill("2026-09-01T06:00");
  await page.getByLabel("Ends").fill("2026-09-01T08:00");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/maps\?marker=/);
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
  await page.goto("/maps");
  const marker = page.getByRole("button", { name: "Test meeting" });
  const documentHeightBeforeOpen = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await marker.click();
  await expect(
    page.getByRole("dialog", { name: "Test meeting" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open in Google Maps" }),
  ).toHaveAttribute("href", /query=13\.7563%2C100\.5018/);
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

test("locked accounts see a read-only create state", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:54321/test/account-access", {
    data: { role: "user", status: "locked" },
  });
  try {
    await page.goto("/login?next=%2Fcreate");
    await page.getByRole("button", { name: /Google/ }).click();
    await expect(
      page.getByRole("heading", { name: "Your account is read-only" }),
    ).toBeVisible();
  } finally {
    await request.post("http://127.0.0.1:54321/test/account-access", {
      data: { role: "admin", status: "active" },
    });
  }
});

test("post category is required and changing it on edit redirects to the new feed", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fcreate%3Ftype%3Dpost%26category%3Dcar");
  await page.getByRole("button", { name: /Google/ }).click();
  const category = page.getByLabel("Community category");
  await expect(category).toHaveAttribute("required", "");
  await expect(category.locator("option")).toHaveCount(4);
  await page.getByLabel("Post text").fill("Category route test");
  await category.selectOption("car");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/community\/car\/talk\?post=/);
  const createdUrl = new URL(page.url());
  await page.goto(`${createdUrl.pathname}${createdUrl.search}&modal=edit`);
  const dialog = page.getByRole("dialog", { name: "Edit post" });
  await dialog.getByLabel("Community category").selectOption("bicycle");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/community\/bicycle\/talk\?post=/);
});

test("legacy community routes preserve their closest destination", async ({
  page,
}) => {
  await page.goto("/community?room=talk&post=p1&modal=edit");
  await expect(page).toHaveURL(/\/community\/groups\?post=p1&modal=edit$/);
  await page.goto("/community?room=market");
  await expect(page).toHaveURL(/\/$/);
});

test("locked owners cannot open garage or profile media write controls", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:54321/test/account-access", {
    data: { role: "user", status: "locked" },
  });
  try {
    await page.goto("/login?next=%2Fusers%2Fe2e_rider");
    await page.getByRole("button", { name: /Google/ }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText("Profile photo")).toHaveCount(0);
    await page.goto("/users/e2e_rider?tab=garage");
    await expect(page.getByRole("link", { name: "Add" })).toHaveCount(0);
    await page.goto("/users/e2e_rider?tab=garage&modal=create-vehicle");
    await expect(page.getByRole("dialog", { name: "Add vehicle" })).toHaveCount(
      0,
    );
  } finally {
    await request.post("http://127.0.0.1:54321/test/account-access", {
      data: { role: "admin", status: "active" },
    });
  }
});

test("maps renders the full map and marker filter FAB without list mode", async ({
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
  await page.goto("/maps");
  const map = page.getByRole("region", { name: "Discover map" });
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await expect(map).not.toHaveAttribute("data-map-raster", "true");
  await expect(canvas).toHaveCSS("filter", "none");
  await expect(page.getByRole("button", { name: "List" })).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Map results" })).toContainText(
    "1 place",
  );
  await expect(
    page.getByRole("button", {
      name: "Drag to rotate map, click to reset north",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enter fullscreen" }),
  ).toBeVisible();
  const filterButton = page.getByRole("button", { name: "Filter markers" });
  await expect(filterButton).toHaveAttribute("aria-pressed", "false");
  await filterButton.click();
  await expect(filterButton).toHaveAttribute("aria-pressed", "true");
  for (const label of ["Meeting", "Event", "Trip"])
    await expect(
      page.getByRole("checkbox", { name: label, exact: true }),
    ).toBeVisible();
  const marker = page.locator(".activity-marker").first();
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS("width", "40px");
  await expect(marker).toHaveCSS("height", "48px");
  await expect(marker).toHaveCSS("clip-path", /polygon\(50% 100%/);
});

test("home categories lead to their nested talk pages", async ({ page }) => {
  await page.goto("/");
  for (const category of ["Cars", "Motorcycles", "Bicycles", "Groups"])
    await expect(
      page.getByRole("link", { name: category, exact: true }),
    ).toBeVisible();
  await page.getByRole("link", { name: "Motorcycles", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Talk/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Market/ })).toHaveCount(0);
});

test("theme selection survives reload", async ({ page }) => {
  await page.goto("/maps");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("map chrome follows theme without replacing the map canvas", async ({
  page,
}) => {
  await page.goto("/maps");
  const map = page.getByRole("region", { name: "Discover map" });
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.evaluate((element) => {
    element.dataset.mapIdentity = "initial";
  });
  await expect(map).toHaveCSS("background-color", "rgb(246, 243, 232)");
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
  await expect(map).toHaveCSS("background-color", "rgb(246, 243, 232)");
  await expect(canvas).toHaveAttribute("data-map-identity", "initial");
  await expect(canvas).toHaveCSS("filter", "none");
});

test("removed product routes redirect home while unknown legacy routes return 404", async ({
  page,
}) => {
  for (const route of ["/profile", "/profile/edit", "/account"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
  }
  for (const route of ["/market", "/photographers/maya"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
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

test("mobile discover map cannot scroll past its visible viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/maps");
  await page.addStyleTag({ content: "body { min-height: 780px; }" });

  await page.evaluate(() => scrollTo(0, 200));

  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(
    await page.evaluate(() => {
      const mapBottom = document
        .querySelector(".discover-map")!
        .getBoundingClientRect().bottom;
      const navigationTop = document
        .querySelector(".mobile-nav-shell")!
        .getBoundingClientRect().top;
      return Math.abs(mapBottom - navigationTop) <= 1;
    }),
  ).toBe(true);
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

test("desktop marker detail uses a tall side panel without document growth", async ({
  page,
}) => {
  const { documentHeightBeforeOpen, marker } = await openMarkerSheet(page, {
    width: 1280,
    height: 900,
  });
  const sheet = page.getByRole("dialog", { name: "Test meeting" });

  expect(
    await sheet.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        clearsHeader: rect.top >= 76,
        pinnedRight: Math.abs(rect.right - innerWidth) < 25,
        tallPanel: rect.height >= innerHeight * 0.7,
      };
    }),
  ).toEqual({ clearsHeader: true, pinnedRight: true, tallPanel: true });
  await expect
    .poll(() =>
      marker.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
      }),
    )
    .toBeCloseTo(1.08, 1);
  await expect(
    page.getByRole("region", { name: "Discover map" }),
  ).toHaveAttribute("data-camera-duration", "420");
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    documentHeightBeforeOpen,
  );
});

test("home keeps mobile choices compact, readable, and keyboard visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const intro = page.locator(".community-home-heading p");
  const cars = page.getByRole("link", { name: "Cars", exact: true });
  expect(
    await intro.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
  expect(
    await cars.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(128);

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(cars).toBeFocused();
  await expect(cars).toHaveCSS("outline-style", "solid");
});

test("reduced motion keeps marker selection instant and understandable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMarkerSheet(page, { width: 1280, height: 900 });

  await expect(
    page.getByRole("region", { name: "Discover map" }),
  ).toHaveAttribute("data-camera-duration", "0");
  await expect(
    page.getByRole("dialog", { name: "Test meeting" }),
  ).toBeVisible();
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
  const googleMaps = dialog.getByRole("link", { name: "Open in Google Maps" });

  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(googleMaps).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(author).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(googleMaps).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await close.click();
  await expect(marker).toBeFocused();
});

test("portaled marker detail resolves map theme tokens in light and dark themes", async ({
  page,
}) => {
  const { marker } = await openMarkerSheet(page, { width: 390, height: 844 });
  const sheet = page.getByRole("dialog", { name: "Test meeting" });
  const close = sheet.getByRole("button", { name: "Close" });

  await close.click();
  await page.getByRole("button", { name: "Settings" }).click();
  const lightSettings = page.getByRole("dialog", { name: "Settings" });
  await lightSettings
    .getByRole("button", { name: "Light", exact: true })
    .click();
  await lightSettings.getByRole("button", { name: "Close" }).click();
  await marker.click();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const light = await sheet.evaluate((element) => {
    const style = getComputedStyle(element);
    const closeStyle = getComputedStyle(
      element.querySelector<HTMLButtonElement>(".sheet-close")!,
    );
    return {
      surface: style.getPropertyValue("--map-paper-raised").trim(),
      text: style.getPropertyValue("--map-ink").trim(),
      focus: style.getPropertyValue("--map-focus").trim(),
      background: style.backgroundColor,
      outline: closeStyle.outlineStyle,
    };
  });

  await close.click();
  await page.getByRole("button", { name: "Settings" }).click();
  const darkSettings = page.getByRole("dialog", { name: "Settings" });
  await darkSettings.getByRole("button", { name: "Dark", exact: true }).click();
  await darkSettings.getByRole("button", { name: "Close" }).click();
  await marker.click();
  const dark = await sheet.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      surface: style.getPropertyValue("--map-paper-raised").trim(),
      text: style.getPropertyValue("--map-ink").trim(),
      focus: style.getPropertyValue("--map-focus").trim(),
    };
  });

  expect(light.surface).not.toBe("");
  expect(light.text).not.toBe("");
  expect(light.focus).not.toBe("");
  expect(light.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(light.outline).toBe("solid");
  expect(dark.surface).not.toBe(light.surface);
  expect(dark.text).not.toBe(light.text);
  expect(dark.focus).not.toBe(light.focus);
});

test("owner edit opens only the edit dialog with contained datetime controls", async ({
  page,
}) => {
  await createOwnerActivity(page);
  const sheet = page.getByRole("dialog", { name: "Owner meeting" });
  await expect(sheet.getByRole("link", { name: "Edit" })).toBeVisible();
  await sheet.getByRole("link", { name: "Edit" }).click();

  const editDialog = page.getByRole("dialog", { name: "Edit details" });
  await expect(editDialog).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(
    await editDialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  for (const name of ["startsAt", "endsAt"]) {
    const input = editDialog.locator(`input[name="${name}"]`);
    expect(
      await input.evaluate((element) => {
        const shell = element.parentElement!;
        const shellRect = shell.getBoundingClientRect();
        const dialogRect = element
          .closest(".edit-modal")!
          .getBoundingClientRect();
        return {
          contained:
            shellRect.left >= dialogRect.left &&
            shellRect.right <= dialogRect.right,
          clipsNativeOverflow: getComputedStyle(shell).overflowX === "hidden",
        };
      }),
    ).toEqual({ contained: true, clipsNativeOverflow: true });
  }
});

test("Google Maps import updates the form and the rendered map location", async ({
  page,
}) => {
  await openActivityCreateForm(page);

  const map = page.locator(".mini-map-preview");
  await page.getByRole("button", { name: "Import from Google Maps" }).click();
  const importDialog = page.getByRole("dialog", {
    name: "Import from Google Maps",
  });
  await expect(importDialog).toBeVisible();
  await page
    .getByLabel("Paste a Google Maps link")
    .fill("https://www.google.com/maps/search/?api=1&query=18.788343,98.9853");
  await importDialog.getByRole("button", { name: "Use this location" }).click();

  await expect(page.locator('input[name="latitude"]')).toHaveValue("18.788343");
  await expect(page.locator('input[name="longitude"]')).toHaveValue("98.9853");
  await expect(page.getByLabel("Latitude")).toHaveValue("18.788343");
  await expect(page.getByLabel("Longitude")).toHaveValue("98.9853");
  await expect(map).toHaveAttribute("data-camera-center", "98.9853,18.788343");
  await expect(
    map.getByRole("img", { name: "Selected location" }),
  ).toHaveAttribute("data-location", "98.9853,18.788343");
  await expect(importDialog).toHaveCount(0);
  await page.getByRole("button", { name: "Import from Google Maps" }).click();
  await expect(page.getByLabel("Paste a Google Maps link")).toHaveValue("");
});

test("an invalid map URL leaves its import panel open with an error", async ({
  page,
}) => {
  await openActivityCreateForm(page);

  await page.getByRole("button", { name: "Import from Google Maps" }).click();
  const importDialog = page.getByRole("dialog", {
    name: "Import from Google Maps",
  });
  await expect(importDialog).toBeVisible();
  await page
    .getByLabel("Paste a Google Maps link")
    .fill("https://example.com/not-a-map");
  await importDialog.getByRole("button", { name: "Use this location" }).click();

  await expect(importDialog).toBeVisible();
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
          const shell = element.parentElement!;
          const shellRect = shell.getBoundingClientRect();
          const gridRect = element
            .closest(".form-stack")!
            .getBoundingClientRect();
          return {
            contained:
              shellRect.left >= gridRect.left &&
              shellRect.right <= gridRect.right,
            clipsNativeOverflow: getComputedStyle(shell).overflowX === "hidden",
          };
        }),
      ).toEqual({ contained: true, clipsNativeOverflow: true });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});
