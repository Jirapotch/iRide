import { expect, test } from "@playwright/test";

for (const width of [375, 1280]) {
  test(`home shortcuts and discovery cards work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const hero = page.locator('[aria-labelledby="home-title"]');
    const community = hero.locator('a[href="/community"]');
    const activities = hero.locator('a[href="/activities"]');
    await expect(community).toBeVisible();
    await expect(activities).toBeVisible();

    const card = page.locator('[data-feature-card="community"]');
    await expect(card).toBeVisible();
    expect(
      await card.evaluate((element) => getComputedStyle(element).minHeight),
    ).toBe(width < 640 ? "280px" : "320px");

    await community.focus();
    await expect(community).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/community$/);
  });
}
