import { expect, test } from "@playwright/test";

test("serves the Thai and English bootstrap shells", async ({ page }) => {
  await page.goto("/th");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "ออกเดินทาง",
  );
  await expect(page.getByRole("link", { name: "English" })).toBeVisible();

  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Every story",
  );
  await expect(page.getByRole("link", { name: "ภาษาไทย" })).toBeVisible();
});

test("serves web and API health contracts", async ({ request }) => {
  const webHealth = await request.get("http://127.0.0.1:3000/api/health");
  await expect(webHealth).toBeOK();
  expect(await webHealth.json()).toMatchObject({
    status: "ok",
    service: "web",
  });

  const apiHealth = await request.get("http://127.0.0.1:3001/api/health");
  await expect(apiHealth).toBeOK();
  expect(await apiHealth.json()).toMatchObject({
    status: "ok",
    service: "api",
  });
});
