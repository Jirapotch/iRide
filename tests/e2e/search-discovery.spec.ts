import { expect, test } from "@playwright/test";

const tripId = "652dc233-b88f-4d35-86af-c780b677be44";

test("empty search offers a path forward and trip results open details", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "iride-locale", value: "th", domain: "127.0.0.1", path: "/" },
  ]);
  await page.route("**/api/v1/search?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data:
          query === "ทริป"
            ? [
                {
                  id: tripId,
                  kind: "event",
                  title: "ทริปภูเขา",
                  subtitle: "เชียงใหม่",
                  username: null,
                },
              ]
            : [],
      }),
    });
  });

  await page.goto("/search?q=ไม่พบแน่นอน");
  await expect(page.getByText("ไม่พบผลลัพธ์")).toBeVisible();
  await expect(
    page.locator('.search-empty-links a[href="/community"]'),
  ).toBeVisible();
  await expect(
    page.locator('.search-empty-links a[href="/activities"]'),
  ).toBeVisible();

  await page.getByRole("button", { name: "ทริป" }).click();
  const trip = page.locator(`a[href="/activities/${tripId}"]`);
  await expect(trip).toBeVisible();
  await trip.click();
  await expect(page).toHaveURL(new RegExp(`/activities/${tripId}$`));
});

test("search errors show retry without suggesting an empty result", async ({
  page,
}) => {
  await page.route("**/api/v1/search?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "SEARCH_UNAVAILABLE" } }),
    }),
  );
  await page.goto("/search?q=offline");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".search-empty-state")).toHaveCount(0);
});
