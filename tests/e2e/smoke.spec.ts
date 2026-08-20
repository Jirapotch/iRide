import { expect, test } from "@playwright/test";

test("landing page and language switch work", async ({ page }) => {
  await page.goto("/th");
  await expect(page.getByRole("heading", { name: "ทุกการเดินทาง มีเรื่องราว" })).toBeVisible();
  await page.getByRole("link", { name: /EN/ }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: "Every ride has a story" })).toBeVisible();
});

test("demo community feed renders", async ({ page }) => {
  await page.goto("/th/feed");
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Narin Chaiyasit" })).toBeVisible();
});
