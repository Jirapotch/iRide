import { expect, test } from "@playwright/test";

test("selecting a marker settles without repeated viewport requests", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api.maptiler.com/maps/**", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#eef1ec" },
          },
        ],
      },
    }),
  );
  await page.route("**/tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route("**/api/explore?**", (route) => {
    requests++;
    return route.fulfill({
      json: {
        data: [
          {
            id: "test-marker",
            kind: "meeting",
            title: "Test meeting",
            subtitle: "Bangkok",
            latitude: 13.7563,
            longitude: 100.5018,
            startsAt: "2026-10-01T10:00:00Z",
            endsAt: null,
            author: { id: "author", username: "rider", displayName: "Rider" },
            canEdit: false,
          },
        ],
      },
    });
  });
  await page.goto("/maps");
  await page.getByRole("button", { name: "Test meeting", exact: true }).click();
  const sheet = page.locator('[data-feature-sheet="test-marker"]');
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/marker=test-marker/);
  // Let the selection camera and one debounced viewport request finish.
  await page.waitForTimeout(2200);
  const settled = requests;
  await page.waitForTimeout(1800);
  expect(requests).toBe(settled);
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.goForward();
  await expect(sheet).toBeVisible();
});
