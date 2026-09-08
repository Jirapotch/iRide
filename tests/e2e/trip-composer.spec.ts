import { expect, test, type Page } from "@playwright/test";

async function importPlace(
  page: Page,
  name: string,
  latitude: number,
  longitude: number,
) {
  await page
    .getByRole("button", { name: "Import from Google Maps", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Paste a Google Maps link" })
    .fill(
      `https://www.google.com/maps/place/${encodeURIComponent(name)}/data=!3d${latitude}!4d${longitude}`,
    );
  await page
    .getByRole("button", { name: "Use this location", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Import from Google Maps", exact: true }),
  ).toHaveCount(0);
}

test("creates a destination-only trip and preserves editable stops and cleared schedule", async ({
  page,
  context,
}, testInfo) => {
  await context.addCookies([
    {
      name: "iride-locale",
      value: "en",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
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
  // Use the signed local auth fixture: WebKit rejects production Secure cookies
  // over the HTTP test origin. OAuth itself is outside this trip regression.
  const session = await (
    await page.request.post(
      "http://127.0.0.1:54321/auth/v1/token?grant_type=pkce",
      { data: {} },
    )
  ).json();
  await context.addCookies([
    {
      name: "iride-auth",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
  await page.goto("/create?type=trip");
  await expect(page).toHaveURL(/\/create\?type=trip/);
  await expect(page.locator('input[name="destinationLatitude"]')).toHaveValue(
    "",
  );
  await importPlace(page, "เชียงใหม่", 18.79, 98.98);
  await expect(page.locator('input[name="title"]')).toHaveValue("เชียงใหม่");
  await expect(page.locator(".coordinate-marker")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("trip-form.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\/maps\?marker=/);
  const id = new URL(page.url()).searchParams.get("marker")!;
  const read = async () =>
    (await (await page.request.get(`/api/bff/events/${id}`)).json()).data;
  expect(await read()).toMatchObject({
    title: "เชียงใหม่",
    latitude: null,
    longitude: null,
    startsAt: null,
    stops: [],
  });
  await expect(page.getByText("Date not set", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Add a start", exact: true })
    .click();
  await importPlace(page, "Bangkok", 13.75, 100.5);
  await page.getByRole("button", { name: /Add a stop/ }).click();
  await importPlace(page, "First stop", 15, 100);
  await page.getByRole("button", { name: /Add a stop/ }).click();
  await importPlace(page, "Second stop", 17, 99);
  await expect(page.locator('input[name="title"]')).toHaveValue("เชียงใหม่");
  await page
    .getByText("Details and schedule (optional)", { exact: true })
    .click();
  await page.locator('input[name="startsAt"]').fill("2026-10-10T09:00");
  await page.locator('input[name="endsAt"]').fill("2026-10-10T18:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).not.toHaveURL(/modal=edit/);
  expect(await read()).toMatchObject({
    locationLabel: "Bangkok",
    startsAt: "2026-10-10T02:00:00.000Z",
    stops: [{ name: "First stop" }, { name: "Second stop" }],
  });

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.locator('input[name="startsAt"]')).toHaveValue(
    "2026-10-10T09:00",
  );
  await page
    .getByRole("button", { name: "Move up", exact: true })
    .last()
    .click();
  await page
    .locator(".trip-place-card")
    .filter({
      has: page.getByRole("textbox", { name: "1 Start", exact: true }),
    })
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await page.locator('input[name="startsAt"]').fill("");
  await page.locator('input[name="endsAt"]').fill("");
  await page.locator('input[name="title"]').fill("Updated trip");
  await importPlace(page, "New destination", 18.8, 99);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).not.toHaveURL(/modal=edit/);
  expect(await read()).toMatchObject({
    locationLabel: null,
    latitude: null,
    startsAt: null,
    endsAt: null,
    stops: [{ name: "Second stop" }, { name: "First stop" }],
  });
  await expect(
    page.getByRole("heading", { name: "Updated trip", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".trip-destination")).toContainText(
    "New destination",
  );
  await expect(page.locator(".trip-sheet-itinerary li").first()).toHaveText(
    "Second stop",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Updated trip", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".trip-point-marker")).toHaveCount(2);
  await expect(page.locator(".trip-point-marker").first()).toBeInViewport();
  await expect(page.locator(".trip-point-marker").last()).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("trip-detail.png"),
    fullPage: true,
  });
});
