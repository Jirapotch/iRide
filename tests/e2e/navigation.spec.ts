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

test("mobile navigation has the new five destinations and an icon-only create action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  for (const item of [
    { name: "Discover", href: "/" },
    { name: "Search", href: "/search" },
    { name: "Create", href: "/create" },
    { name: "Community", href: "/community" },
    { name: "Profile", href: "/login?intent=profile" },
  ])
    await expect(nav.getByRole("link", { name: item.name })).toHaveAttribute(
      "href",
      item.href,
    );
  await expect(
    nav.getByRole("link", { name: "Create" }).locator(".sr-only"),
  ).toHaveText("Create");
});

test("mobile create control aligns with the other bottom navigation destinations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  const create = nav.getByRole("link", { name: "Create" });
  const discover = nav.getByRole("link", { name: "Discover" });

  expect(
    await create.evaluate(
      (element, reference) => {
        const createRect = element.getBoundingClientRect();
        const referenceRect = (
          reference as HTMLElement
        ).getBoundingClientRect();
        return (
          Math.abs(createRect.top - referenceRect.top) < 1 &&
          Math.abs(createRect.bottom - referenceRect.bottom) < 1
        );
      },
      await discover.elementHandle(),
    ),
  ).toBe(true);
  await expect(create.locator(".sr-only")).toHaveText("Create");
});

test("search is a page and absent from header actions", async ({ page }) => {
  await page.goto("/search");
  await expect(
    page.getByRole("heading", { name: "Search across iRide" }),
  ).toBeVisible();
  await expect(
    page.locator(".header-actions").getByRole("button", { name: "Search" }),
  ).toHaveCount(0);
});

test("settings contains theme and language without account settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const drawer = page.getByRole("dialog", { name: "Settings" });
  await expect(drawer.getByText("Theme")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Light" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Dark" })).toBeVisible();
  await expect(drawer.getByText("Account settings")).toHaveCount(0);
});
