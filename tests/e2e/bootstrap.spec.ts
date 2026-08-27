import { expect, test } from "@playwright/test";

test("detects Thai and English from the browser without changing the URL", async ({
  browser,
}) => {
  const thaiContext = await browser.newContext({ locale: "th-TH" });
  const thaiPage = await thaiContext.newPage();
  await thaiPage.goto("/");
  await expect(thaiPage).toHaveURL(/\/$/);
  await expect(thaiPage.getByRole("heading", { level: 1 })).toHaveText(
    "ฟีดของคุณ",
  );
  await thaiContext.close();

  const englishContext = await browser.newContext({ locale: "en-US" });
  const englishPage = await englishContext.newPage();
  await englishPage.goto("/");
  await expect(englishPage).toHaveURL(/\/$/);
  await expect(englishPage.getByRole("heading", { level: 1 })).toHaveText(
    "Your feed",
  );
  await englishContext.close();
});

test("persists a language switch on the same clean path", async ({ page }) => {
  await page.goto("/");
  const switchToThai = page.getByRole("button", { name: "ภาษาไทย" });

  if (await switchToThai.isVisible()) {
    await switchToThai.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "ฟีดของคุณ",
    );
  }

  await page.getByRole("button", { name: "English" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your feed");

  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  const localeCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "iride-locale",
  );
  expect(localeCookie).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
    value: "en",
  });
});

test("returns 404 for locale-prefixed legacy routes", async ({ page }) => {
  for (const pathname of ["/th", "/en", "/th/account", "/en/auth/callback"]) {
    const response = await page.goto(pathname);
    expect(response?.status(), pathname).toBe(404);
  }
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
