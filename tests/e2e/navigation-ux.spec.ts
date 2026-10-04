import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
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
});

test("hub Open link preserves layout while navigation waits", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route("**/games?_rsc=**", async (route) => {
    await held;
    await route.continue();
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.locator('[data-ride-feature="games"]').click();
  const games = page.locator('[data-ui="ride-hub"] a[href="/games"]');
  const width = await games.evaluate(
    (element) => element.getBoundingClientRect().width,
  );

  try {
    await games.hover();
    await games.click({ noWaitAfter: true });
    await expect(games).toHaveAttribute("aria-busy", "true");
    await page.mouse.move(0, 0);
    expect(
      await games.evaluate((element) => element.getBoundingClientRect().width),
    ).toBe(width);
  } finally {
    release?.();
  }

  await expect(page).toHaveURL(/\/games$/);
});

test("hub feature buttons retain layout on keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const grid = page.locator('[data-ui="ride-hub"]');
  const community = grid.locator('[data-ride-feature="community"]');
  const cards = grid.locator("[data-ride-feature]");
  await expect(page.locator('[data-ui="ride-hub"]')).toBeVisible();
  await expect(cards).toHaveCount(6);
  expect(
    await cards.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-ride-feature")),
    ),
  ).toEqual([
    "community",
    "activities",
    "trips",
    "routes",
    "knowledge",
    "games",
  ]);
  const widthsBefore = await cards.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );
  await community.focus();

  await expect(community).toBeFocused();
  const widthsAfter = await cards.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );
  expect(widthsAfter).toEqual(widthsBefore);
});

test("all six hub features expose their destination at the device width", async ({
  page,
}) => {
  await page.goto("/");
  const cards = page.locator('[data-ui="ride-hub"] [data-ride-feature]');
  await expect(cards).toHaveCount(6);
  for (const [feature, href] of [
    ["community", "/community"],
    ["activities", "/activities"],
    ["trips", "/activities?kinds=trip"],
    ["routes", "/maps"],
    ["knowledge", "/knowledge"],
    ["games", "/games"],
  ]) {
    await page.locator(`[data-ride-feature="${feature}"]`).click();
    await expect(
      page.locator(`[data-ui="ride-hub"] a[href="${href}"]`),
    ).toBeVisible();
  }
  const positions = await cards.evaluateAll((items) =>
    items.map((item) => ({
      top: item.getBoundingClientRect().top,
      left: item.getBoundingClientRect().left,
    })),
  );
  if (page.viewportSize()!.width < 768) {
    expect(positions[0]!.top).toBe(positions[1]!.top);
    expect(positions[1]!.top).toBe(positions[2]!.top);
    expect(positions[2]!.top).toBeLessThan(positions[3]!.top);
    expect(positions[3]!.top).toBe(positions[5]!.top);
  } else {
    expect(positions[0]!.top).toBe(positions[1]!.top);
    expect(positions[2]!.top).toBe(positions[3]!.top);
  }
});

test("main navigation stays available while a destination shell loads", async ({
  page,
}) => {
  await page.goto("/maps?marker=missing-marker");

  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
});

test("games navigation exposes immediate pending feedback", async ({
  page,
}) => {
  await page.goto("/games");
  const game = page.getByRole("link", {
    name: /Traffic Endless Ride/,
  });
  await expect(game.locator(".link-pending-indicator")).toHaveCount(1);
});
