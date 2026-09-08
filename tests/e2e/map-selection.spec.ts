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
  await expect(
    page.getByRole("button", { name: "Enter fullscreen" }),
  ).toHaveCount(0);
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

test("keeps trip actions visible and focuses the selected route point", async ({
  page,
}) => {
  await page.route("**/api.maptiler.com/maps/**", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [{ id: "background", type: "background" }],
      },
    }),
  );
  await page.route("**/api/explore?**", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "test-trip",
            kind: "trip",
            title: "Mountain route",
            subtitle: "Finish",
            latitude: 19,
            longitude: 98,
            startsAt: null,
            endsAt: null,
            author: { id: "author", username: "rider", displayName: "Rider" },
            canEdit: false,
          },
        ],
      },
    }),
  );
  await page.route("**/api/bff/events/test-trip", (route) =>
    route.fulfill({
      json: {
        data: {
          id: "test-trip",
          kind: "trip",
          title: "Mountain route",
          description: null,
          locationLabel: "Start",
          latitude: 13,
          longitude: 100,
          destinationLabel: "Finish",
          destinationLatitude: 19,
          destinationLongitude: 98,
          startsAt: null,
          endsAt: null,
          timezone: "Asia/Bangkok",
          vehicleKinds: ["car"],
          organizer: { id: "author", username: "rider", displayName: "Rider" },
          canEdit: false,
          createdAt: "2026-09-08T00:00:00.000Z",
          updatedAt: "2026-09-08T00:00:00.000Z",
          stops: [
            { name: "First stop", latitude: 15, longitude: 99 },
            { name: "Second stop", latitude: 17, longitude: 98.5 },
          ],
        },
      },
    }),
  );

  await page.goto("/maps");
  await page
    .getByRole("button", { name: "Mountain route" })
    .evaluate((element) => (element as HTMLButtonElement).click());
  const sheet = page.locator('[data-feature-sheet="test-trip"]');
  const header = sheet.locator(".activity-sheet-header");
  const details = header.getByRole("link", { name: "Details" });
  await expect(header).toHaveCSS("position", "sticky");
  await expect(details).toHaveAttribute("href", "/activities/test-trip");

  const secondStop = sheet.getByRole("button", {
    name: "Show Second stop on map",
  });
  await secondStop.click();
  await expect(secondStop).toHaveAttribute("aria-pressed", "true");
  await expect(sheet).toHaveAttribute("data-route-focus", "2");
  await expect(page).toHaveURL(/\/maps\?marker=test-trip$/);

  await header.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await page.goForward();
  await expect(sheet).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "Show Second stop on map" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(sheet).not.toHaveAttribute("data-route-focus", /.+/);

  await sheet.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(header.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(details).toBeVisible();
});
