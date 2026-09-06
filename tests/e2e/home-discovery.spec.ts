import { expect, test } from "@playwright/test";

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
  await page.route("**/api/bff/posts", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "post-1",
            body: "Who is joining the sunrise ride this weekend?",
            communityCategory: "motorcycle",
            author: {
              id: "author-1",
              username: "rider",
              displayName: "Rider",
            },
            canEdit: false,
            commentCount: 8,
            markerTags: [],
            createdAt: "2026-09-05T00:00:00.000Z",
            updatedAt: "2026-09-05T00:00:00.000Z",
          },
          {
            id: "post-2",
            body: "A quiet coffee road for Sunday morning.",
            communityCategory: "car",
            author: {
              id: "author-2",
              username: "driver",
              displayName: "Driver",
            },
            canEdit: false,
            commentCount: 3,
            markerTags: [],
            createdAt: "2026-09-04T00:00:00.000Z",
            updatedAt: "2026-09-04T00:00:00.000Z",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/bff/events", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "event-1",
            kind: "trip",
            title: "Bangkok to Khao Yai",
            description: "A calm weekend drive",
            locationLabel: "Bangkok",
            latitude: 13.7563,
            longitude: 100.5018,
            destinationLabel: "Khao Yai",
            destinationLatitude: 14.439,
            destinationLongitude: 101.372,
            startsAt: "2099-09-14T06:00:00.000Z",
            endsAt: null,
            timezone: "Asia/Bangkok",
            vehicleKinds: ["car"],
            organizer: {
              id: "author-1",
              username: "rider",
              displayName: "Rider",
            },
            canEdit: false,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/bff/profile/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "AUTH_REQUIRED" } }),
    }),
  );
});

test("home presents three living feature destinations and opens games showcase", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Every road has a story" }),
  ).toBeVisible();
  const featureGrid = page.locator('[data-ui="feature-selection"]');
  for (const label of ["Community", "Games", "Activities"]) {
    await expect(featureGrid.getByRole("link", { name: label })).toBeVisible();
  }

  await featureGrid.getByRole("link", { name: "Community" }).hover();
  await expect(featureGrid).toHaveAttribute("data-active", "community");

  await featureGrid.getByRole("link", { name: "Games" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(
    page.getByRole("heading", { name: "Traffic Endless Ride" }),
  ).toBeFocused();
  await expect(page.getByText("Preview", { exact: true })).toBeVisible();
  await expect(page.getByText(/high score/i)).toHaveCount(0);
});

test("mobile home uses story cards without pointer-only behavior or overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const featureGrid = page.locator('[data-ui="feature-selection"]');
  await expect(featureGrid).toHaveAttribute("data-pointer-enabled", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  const activities = featureGrid.getByRole("link", { name: "Activities" });
  await featureGrid.getByRole("link", { name: "Games" }).focus();
  await page.keyboard.press("Tab");
  await expect(activities).toBeFocused();
  await activities.dispatchEvent("pointerout", {
    bubbles: true,
    pointerType: "mouse",
  });
  await expect(featureGrid).toHaveAttribute("data-active", "activities");
  await expect(activities).toHaveCSS("outline-style", "solid");
});

test("home sections fail independently", async ({ page }) => {
  await page.route("**/api/bff/posts", (route) => route.abort());
  await page.goto("/");

  await expect(
    page.getByText("Community stories could not load"),
  ).toBeVisible();
  await expect(page.getByText("Bangkok to Khao Yai")).toBeVisible();
});

test("trending filter changes stories without reloading the URL", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Who is joining the sunrise ride this weekend?"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cars", exact: true }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText("A quiet coffee road for Sunday morning."),
  ).toBeVisible();
  await expect(
    page.getByText("Who is joining the sunrise ride this weekend?"),
  ).toHaveCount(0);
});

test("activity map preview waits until its section approaches the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const preview = page.locator('[data-ui="home-mini-map"]');
  await expect(preview).not.toHaveAttribute("data-map-requested", "true");

  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute("data-map-requested", "true");
});

test("reduced motion preserves feature focus and navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const community = page.getByRole("link", { name: "Community", exact: true });

  await community.focus();
  await expect(community).toBeFocused();
  await community.press("Enter");
  await expect(page).toHaveURL(/\/community\/groups$/);
});

test("reduced motion disables desktop pointer parallax", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/");

  await expect(page.locator('[data-ui="feature-selection"]')).toHaveAttribute(
    "data-pointer-enabled",
    "false",
  );
  await context.close();
});
