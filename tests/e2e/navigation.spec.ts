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

test("navigates the public prototype on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-ui="app-shell"]')).toHaveAttribute(
    "data-theme",
    "automotive-premium",
  );
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });

  await expect(navigation.getByRole("link", { name: "Feed" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  for (const destination of [
    { label: "Explore", pathname: "/explore", heading: "Explore the road" },
    { label: "Create", pathname: "/create", heading: "Create a story" },
    { label: "Garage", pathname: "/garage", heading: "Your garage" },
  ]) {
    await navigation.getByRole("link", { name: destination.label }).click();
    await expect(page).toHaveURL(new RegExp(`${destination.pathname}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      destination.heading,
    );
    await expect(
      navigation.getByRole("link", { name: destination.label }),
    ).toHaveAttribute("aria-current", "page");
  }

  await navigation.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  await expect(page.locator('[data-ui="standalone-shell"]')).toHaveAttribute(
    "data-theme",
    "automotive-premium",
  );
});

test("shows the desktop navigation and supports keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });

  await expect(navigation).toBeVisible();
  const exploreLink = navigation.getByRole("link", { name: "Explore" });
  await exploreLink.focus();
  await expect(exploreLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/explore$/);
  await expect(exploreLink).toHaveAttribute("aria-current", "page");
});
