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

test("pointer focus does not leave a feature card selected while navigation waits", async ({
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

  const grid = page.locator('[data-ui="feature-selection"]');
  const games = page.getByRole("link", { name: "Games", exact: true });

  try {
    await games.hover();
    await expect(grid).toHaveAttribute("data-active", "games");
    await games.click({ noWaitAfter: true });
    await expect(games).toHaveAttribute("aria-busy", "true");
    await page.mouse.move(0, 0);
    await expect(grid).toHaveAttribute("data-active", "none");
  } finally {
    release?.();
  }

  await expect(page).toHaveURL(/\/games$/);
});

test("feature cards keep equal widths and the requested order on focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const grid = page.locator('[data-ui="feature-selection"]');
  const community = page.getByRole("link", {
    name: "Community",
    exact: true,
  });
  const cards = grid.locator("[data-feature-card]");
  await expect(page.getByText("COMMUNITY • ACTIVITIES • GAMES")).toBeVisible();
  await expect(cards).toHaveCount(3);
  expect(
    await cards.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-feature-card")),
    ),
  ).toEqual(["community", "activities", "games"]);
  const widthsBefore = await cards.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );
  await community.focus();

  await expect(community).toBeFocused();
  await expect(community).toHaveCSS("outline-style", "solid");
  await expect(grid).toHaveAttribute("data-active", "community");
  const widthsAfter = await cards.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );
  expect(widthsAfter).toEqual(widthsBefore);
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
