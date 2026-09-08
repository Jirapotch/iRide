import { expect, test } from "@playwright/test";

test("moves from Home through an activity detail before opening its map", async ({
  context,
  page,
}) => {
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

  const create = await page.request.post("/api/bff/events", {
    data: {
      kind: "trip",
      title: "Mountain route",
      description: "A route for the activities flow",
      locationLabel: "Bangkok",
      latitude: 13.75,
      longitude: 100.5,
      destinationLabel: "Chiang Mai",
      destinationLatitude: 18.79,
      destinationLongitude: 98.98,
      startsAt: "2099-10-10T02:00:00.000Z",
      endsAt: "2099-10-10T11:00:00.000Z",
      timezone: "Asia/Bangkok",
      vehicleKinds: ["car", "motorcycle"],
      stops: [{ name: "First stop", latitude: 15, longitude: 100 }],
    },
  });
  expect(create.ok()).toBe(true);
  const trip = (await create.json()).data as { id: string };

  await page.goto("/");
  const activities = page.getByRole("link", {
    name: "Activities",
    exact: true,
  });
  await expect(activities).toHaveAttribute("href", "/activities");
  await activities.click();
  await expect(page).toHaveURL(/\/activities$/);
  await expect(
    page.getByRole("heading", { name: "Activities", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Trip", exact: true }).click();
  await page.locator(`a[href="/activities/${trip.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/activities/${trip.id}$`));
  await expect(
    page.getByRole("heading", { name: "Mountain route", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-route-stop]")).toHaveCount(3);
  await expect(page.locator("[data-route-stop]").nth(0)).toContainText(
    "Bangkok",
  );
  await expect(page.locator("[data-route-stop]").nth(1)).toContainText(
    "First stop",
  );
  await expect(page.locator("[data-route-stop]").nth(2)).toContainText(
    "Chiang Mai",
  );
  await expect(
    page
      .locator("[data-route-stop]")
      .nth(1)
      .getByRole("link", { name: "Open in Google Maps" }),
  ).toHaveAttribute("href", /query=15%2C100/);

  await page
    .getByRole("link", { name: "View on iRide map", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/maps\\?marker=${trip.id}&from=activities`),
  );
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb).toContainText("Activities");
  await expect(breadcrumb).toContainText("Mountain route");
  await expect(breadcrumb).toContainText("Maps");

  await page.getByRole("button", { name: "Filter markers" }).click();
  await page.getByText("Meeting", { exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/maps\\?layers=event%2Ctrip&marker=${trip.id}&from=activities`),
  );
  await expect(breadcrumb).toContainText("Mountain route");
});
