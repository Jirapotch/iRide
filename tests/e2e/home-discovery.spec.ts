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
          {
            id: "post-3",
            body: "City ride after work.",
            communityCategory: "bicycle",
            author: {
              id: "author-3",
              username: "cyclist",
              displayName: "Cyclist",
            },
            canEdit: false,
            commentCount: 2,
            markerTags: [],
            createdAt: "2026-09-03T00:00:00.000Z",
            updatedAt: "2026-09-03T00:00:00.000Z",
          },
          {
            id: "post-4",
            body: "Weekend meetup planning from the real groups feed.",
            communityCategory: "groups",
            author: {
              id: "author-4",
              username: "organizer",
              displayName: "Organizer",
            },
            canEdit: false,
            commentCount: 5,
            markerTags: [],
            createdAt: "2026-09-06T00:00:00.000Z",
            updatedAt: "2026-09-06T00:00:00.000Z",
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
  for (const [label, href] of [
    ["Community", "/community/groups"],
    ["Games", "/games"],
    ["Activities", "/maps"],
  ]) {
    await expect(
      featureGrid.getByRole("link", { name: label }),
    ).toHaveAttribute("href", href);
  }
  await expect(
    featureGrid.getByText("Weekend meetup planning from the real groups feed."),
  ).toBeVisible();
  await expect(featureGrid.getByText("Bangkok to Khao Yai")).toBeVisible();

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

test("community vehicle cards use real posts and expose destination buttons", async ({
  page,
}) => {
  await page.goto("/");

  const categories = page.locator('[data-ui="community-categories"]');
  await expect(
    categories.getByText("A quiet coffee road for Sunday morning."),
  ).toBeVisible();
  await expect(
    categories.getByText("Who is joining the sunrise ride this weekend?"),
  ).toBeVisible();
  await expect(categories.getByText("City ride after work.")).toBeVisible();
  await expect(page.getByText("Demo content", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Weekend Roads", { exact: true })).toHaveCount(0);

  for (const [name, href] of [
    ["View Cars community", "/community/car/talk"],
    ["View Motorcycles community", "/community/motorcycle/talk"],
    ["View Bicycles community", "/community/bicycle/talk"],
  ]) {
    await expect(categories.getByRole("link", { name })).toHaveAttribute(
      "href",
      href,
    );
  }
});

test("games stays a static preview without API requests or browser history", async ({
  page,
}) => {
  const gamesRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/bff/games"))
      gamesRequests.push(request.url());
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("iride.home.recent.v1"));

  await page.getByRole("link", { name: "Games", exact: true }).click();

  await expect(page).toHaveURL(/\/games$/);
  expect(gamesRequests).toEqual([]);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("iride.home.recent.v1") ?? "[]").some(
        (item: { kind?: string }) => item.kind === "games",
      ),
    ),
  ).toBe(false);
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
  await activities.focus();
  await expect(activities).toBeFocused();
  await expect(featureGrid).toHaveAttribute("data-active", "activities");
  await expect(activities).toHaveCSS("outline-style", "solid");
});

test("home sections fail independently", async ({ page }) => {
  await page.route("**/api/bff/posts", (route) => route.abort());
  await page.goto("/");

  await expect(
    page.getByText("Community stories could not load"),
  ).toBeVisible();
  await expect(
    page
      .locator('[aria-labelledby="activities-title"]')
      .getByRole("heading", { name: "Bangkok to Khao Yai" }),
  ).toBeVisible();
});

test("trending filter changes stories without reloading the URL", async ({
  page,
}) => {
  await page.goto("/");
  const trending = page.locator('[aria-labelledby="trending-title"]');
  await expect(
    trending.getByText("Who is joining the sunrise ride this weekend?"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cars", exact: true }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    trending.getByText("A quiet coffee road for Sunday morning."),
  ).toBeVisible();
  await expect(
    trending.getByText("Who is joining the sunrise ride this weekend?"),
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
