import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "iride-locale", value: "en", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
});

test("mobile navigation contains exactly five primary destinations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  for (const destination of [{ label: "Discover", path: "/" }, { label: "Community", path: "/community" }, { label: "Create", path: "/create" }, { label: "Market", path: "/market" }]) {
    await nav.getByRole("link", { name: destination.label }).click();
    await expect(page).toHaveURL(new RegExp(destination.path === "/" ? "/$" : `${destination.path}$`));
    await expect(nav.getByRole("link", { name: destination.label })).toHaveAttribute("aria-current", "page");
  }
  await nav.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
});

test("language and account actions live only in settings drawer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("เปลี่ยนเป็นภาษาไทย")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  const drawer = page.getByRole("dialog", { name: "Settings" });
  await expect(drawer.getByText("Language")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: /เปลี่ยนเป็นภาษาไทย/ })).toBeVisible();
});

test("desktop header uses the same five destinations", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  await nav.getByRole("link", { name: "Market" }).focus();
  await expect(nav.getByRole("link", { name: "Market" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/market$/);
});
