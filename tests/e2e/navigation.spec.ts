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
    { name: "Home", href: "/" },
    { name: "Maps", href: "/maps" },
    { name: "Create", href: "/create" },
    { name: "Search", href: "/search" },
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
  const discover = nav.getByRole("link", { name: "Home" });

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

test("browser Back restores the search query", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Search" }).click();
  const input = page.getByRole("textbox", { name: "Search" });
  await input.fill("ride");
  await expect(page).toHaveURL(/\/search\?q=ride$/);
  await expect(input).toHaveValue("ride");
  await page.getByRole("link", { name: "iRide home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?q=ride$/);
  await expect(input).toHaveValue("ride");
});

test("failed search offers retry without clearing the query", async ({
  page,
}) => {
  await page.route("**/api/v1/search?**", (route) => route.abort());
  await page.goto("/search?q=ride");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search" })).toHaveValue(
    "ride",
  );
});

test("nested community routes expose responsive breadcrumbs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/community/car/talk");
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(breadcrumb.getByRole("link", { name: "Cars" })).toBeVisible();
  await expect(breadcrumb.getByText("Talk", { exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(breadcrumb.locator(".breadcrumb-full")).toHaveCSS(
    "position",
    "absolute",
  );
  await expect(
    breadcrumb.getByRole("link", { name: "Back to Cars" }),
  ).toBeVisible();
});

test("a slow destination acknowledges one navigation", async ({ page }) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/community/car*", async (route) => {
    if (route.request().headers().rsc === "1") await held;
    await route.continue();
  });
  await page.goto("/");
  const cars = page.getByRole("link", { name: "Cars", exact: true });

  try {
    await cars.click({ noWaitAfter: true });
    await expect(cars).toHaveAttribute("aria-busy", "true");
    await expect(cars.locator(".link-pending-indicator")).toHaveAttribute(
      "data-pending",
      "true",
    );
    await cars.dispatchEvent("click");
  } finally {
    release?.();
  }

  await expect(page).toHaveURL(/\/community\/car$/);
});

test("pathname navigation focuses the destination heading", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Cars", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cars" })).toBeFocused();
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

test("active administrators can open the user management list", async ({
  page,
}) => {
  await page.goto("/login?next=%2F");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Manage users" }).click();
  await expect(
    page.getByRole("heading", { name: "Manage users" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /E2E Rider/ })).toBeVisible();
  await expect(page.getByText("oauth-user@iride.test")).toBeVisible();

  await page
    .getByRole("textbox", { name: "Search users" })
    .fill("locked@iride.test");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("link", { name: /Locked Rider/ })).toBeVisible();
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/settings\/users$/);
  await expect(page.getByRole("link", { name: /E2E Rider/ })).toBeVisible();
});

test("administrators can unlock a locked user", async ({ page }) => {
  await page.goto("/login?next=%2Fsettings%2Fusers");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByRole("link", { name: /Locked Rider/ }).click();
  await expect(page.getByText("user · locked", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByText("user · active", { exact: true })).toBeVisible();
});

test("admin detail returns to the exact filtered list", async ({ page }) => {
  await page.goto("/login?next=%2Fsettings%2Fusers%3Fq%3Dlocked%26page%3D1");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByRole("link", { name: /Locked Rider/ }).click();
  await page.getByRole("button", { name: "Back to user list" }).click();
  await expect(page).toHaveURL(/\/settings\/users\?q=locked/);
  await expect(page.getByRole("textbox", { name: "Search users" })).toHaveValue(
    "locked",
  );
});

test("a directly opened admin detail uses its safe fallback", async ({
  page,
}) => {
  const next = encodeURIComponent(
    "/settings/users/22222222-2222-4222-8222-222222222222?from=/settings/users?q=locked",
  );
  await page.goto(`/login?next=${next}`);
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByRole("button", { name: "Back to user list" }).click();
  await expect(page).toHaveURL(/\/settings\/users\?q=locked$/);
});

test("browser Back restores the filtered list scroll position", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fsettings%2Fusers%3Fq%3Drider");
  await page.getByRole("button", { name: /Google/ }).click();
  const detailLink = page
    .getByRole("link", { name: /Rider/ })
    .filter({ visible: true })
    .first();
  await page.addStyleTag({
    content: "html, body { min-height: 2400px !important; }",
  });
  await detailLink.evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.style.height = "1200px";
    element.closest(".admin-user-table")?.before(spacer);
    element.scrollIntoView({ block: "center" });
  });
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(200);
  await detailLink.click();
  await page.getByRole("button", { name: "Back to user list" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (target) => {
          const maximum =
            document.documentElement.scrollHeight - window.innerHeight;
          return window.scrollY >= Math.min(target - 2, maximum - 2);
        },
        before,
      ),
    )
    .toBe(true);
});

test("a destination error keeps navigation available", async ({ page }) => {
  await page.goto("/login?next=%2Fsettings%2Fusers%2Fnot-a-user");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/settings\/users\/not-a-user$/);
  await expect(page.locator(".route-error")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
});
