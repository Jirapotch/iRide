import { expect, test } from "@playwright/test";

test("landing page and language switch work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ทุกการเดินทาง มีเรื่องราว" })).toBeVisible();
  await page.getByRole("button", { name: /EN/ }).click();
  await expect(page.getByRole("heading", { name: "Every ride has a story" })).toBeVisible();
});

test("anonymous users can read the feed without member controls", async ({ page }) => {
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
  await expect(page.getByTestId("viewer-profile-card")).toHaveCount(0);
  await expect(page.getByTestId("post-composer")).toHaveCount(0);
  await expect(page.getByTestId("post-actions")).toHaveCount(0);
  await expect(page.getByTestId("member-profile-link")).toHaveCount(0);
  await expect(page.getByTestId("member-garage-link")).toHaveCount(0);
  await expect(page.getByTestId("member-new-post-link")).toHaveCount(0);
});

test("anonymous users are redirected from a member profile with a return path", async ({ page }) => {
  await page.goto("/profile/narin.drives");
  await expect(page).toHaveURL(/\/auth\?next=%2Fprofile%2Fnarin\.drives$/);
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ส่งลิงก์เข้าสู่ระบบ" })).toBeVisible();
});
