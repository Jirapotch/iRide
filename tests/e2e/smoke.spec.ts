import { expect, test } from "@playwright/test";

test("root is the public feed with a visible login card", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
  await expect(page.getByTestId("guest-login-card")).toBeVisible();
  await expect(page.getByTestId("viewer-profile-card")).toHaveCount(0);
  await expect(page.getByTestId("post-composer")).toHaveCount(0);
  await expect(page.getByTestId("post-actions")).toHaveCount(0);
});

test("legacy feed URL redirects to the root and preserves its query", async ({ page }) => {
  await page.goto("/feed?tab=garage");
  await expect(page).toHaveURL(/\/\?tab=garage$/);
});

test("login only offers Google", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "ดำเนินการต่อด้วย Google" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveCount(0);
});

test("legacy auth URL redirects to login and preserves the return path", async ({ page }) => {
  await page.goto("/auth?next=%2Fsettings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
});

test("anonymous users are redirected from a member profile with a return path", async ({ page }) => {
  await page.goto("/profile/narin.drives");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile%2Fnarin\.drives$/);
  await expect(page.getByRole("button", { name: "ดำเนินการต่อด้วย Google" })).toBeVisible();
});
