import { expect, test } from "@playwright/test";

for (const width of [375, 1280]) {
  test(`home shortcuts and discovery cards work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const community = page.locator('[data-ride-feature="community"]');
    const activities = page.locator('[data-ride-feature="activities"]');
    await expect(community).toBeVisible();
    await expect(activities).toBeVisible();

    const card = community;
    await expect(card).toBeVisible();
    expect(
      await card.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);

    await community.focus();
    await expect(community).toBeFocused();
    await page.keyboard.press("Enter");
    await page.locator('[data-ui="ride-hub"] a[href="/community"]').click();
    await expect(page).toHaveURL(/\/community$/);
  });
}
