import { expect, test } from "@playwright/test";

test("landing page and language switch work", async ({ page }) => {
  await page.goto("/th");
  await expect(page.getByRole("heading", { name: "ทุกการเดินทาง มีเรื่องราว" })).toBeVisible();
  await page.getByRole("link", { name: /EN/ }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: "Every ride has a story" })).toBeVisible();
});

test("anonymous users are redirected from the community feed to auth", async ({ page }) => {
  await page.goto("/th/feed");
  await expect(page).toHaveURL(/\/th\/auth\?next=%2Fth%2Ffeed$/);
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ส่งลิงก์เข้าสู่ระบบ" })).toBeVisible();
});
