import { expect, test } from "@playwright/test";

async function authenticate(page: import("@playwright/test").Page) {
  const session = await (
    await page.request.post(
      "http://127.0.0.1:54321/auth/v1/token?grant_type=pkce",
      { data: {} },
    )
  ).json();
  await page.context().addCookies([
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
}

for (const mode of ["light", "dark"] as const) {
  test(`renders the balanced signal theme in ${mode} mode`, async ({
    page,
  }) => {
    await page.addInitScript((theme) => {
      window.localStorage.setItem("iride-theme", theme);
    }, mode);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/");

    const theme = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const active = document.querySelector<HTMLElement>(".nav-item.is-active");
      const create = document.querySelector<HTMLElement>(".create-orb");
      return {
        signal: root.getPropertyValue("--signal").trim(),
        signalStrong: root.getPropertyValue("--signal-strong").trim(),
        signalText: root.getPropertyValue("--signal-text").trim(),
        danger: root.getPropertyValue("--danger").trim(),
        activeColor: active ? getComputedStyle(active).color : "",
        createBackground: create
          ? getComputedStyle(create).backgroundImage
          : "",
      };
    });

    expect(theme.signal).toBe("#ef3834");
    expect(theme.signalStrong).not.toBe("");
    expect(theme.signalText).not.toBe("");
    expect(theme.danger).toBe(mode === "light" ? "#8b3158" : "#ff9cbd");
    expect(theme.activeColor).toBe(
      mode === "light" ? "rgb(180, 35, 32)" : "rgb(255, 154, 149)",
    );
    expect(theme.createBackground).toContain("rgb(239, 56, 52)");
    expect(theme.createBackground).toContain("rgb(111, 143, 114)");
  });
}

test("keeps Signal and Matcha visible across desktop app surfaces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");

  const appBackground = await page
    .locator(".app-frame")
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(appBackground).toContain("rgba(239, 56, 52, 0.09)");
  expect(appBackground).toContain("rgba(185, 220, 105, 0.16)");

  await page.goto("/login?intent=profile");
  const loginButtonBackground = await page
    .locator(".ant-btn-primary")
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(loginButtonBackground).toContain("rgb(180, 35, 32)");
});

test("keeps community CTA focus and hover states at AA contrast", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/community");

  const carCta = page.locator('[data-kind="car"] a');
  await carCta.hover();
  const colors = await carCta.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, foreground: style.color };
  });

  expect(colors.background).toBe("rgb(180, 35, 32)");
  expect(colors.foreground).toBe("rgb(255, 255, 255)");

  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  await carCta.focus();
  await expect(carCta).toBeFocused();
  expect(
    await carCta.evaluate((element) => element.matches(":focus-visible")),
  ).toBe(true);
  const focusColors = await carCta.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, foreground: style.color };
  });
  expect(focusColors).toEqual(colors);
});

test("applies the signal treatment to activity cards and profile tabs", async ({
  page,
}) => {
  await authenticate(page);
  const create = await page.request.post("/api/bff/events", {
    data: {
      kind: "trip",
      title: "Signal route",
      description: "Theme regression fixture",
      locationLabel: "Bangkok",
      latitude: 13.75,
      longitude: 100.5,
      destinationLabel: "Chiang Mai",
      destinationLatitude: 18.79,
      destinationLongitude: 98.98,
      startsAt: "2099-10-10T02:00:00.000Z",
      endsAt: "2099-10-10T11:00:00.000Z",
      timezone: "Asia/Bangkok",
      vehicleKinds: ["car"],
      stops: [],
    },
  });
  expect(create.ok()).toBe(true);
  const trip = (await create.json()).data as { id: string };

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/activities");
  const activityBackground = await page
    .locator(`a[href="/activities/${trip.id}"]`)
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(activityBackground).toContain("rgba(239, 56, 52, 0.05)");

  await page.goto("/users/e2e_rider");
  const activeTabColor = await page
    .locator('[data-profile-tab="overview"]')
    .evaluate((element) => getComputedStyle(element).color);
  expect(activeTabColor).toBe("rgb(180, 35, 32)");
});

test("removes nonessential signal-theme motion when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");

  const motion = await page.evaluate(() => {
    const route = document.querySelector<HTMLElement>(".route-content");
    const active = document.querySelector<HTMLElement>(".nav-item.is-active");
    return {
      routeAnimation: route ? getComputedStyle(route).animationName : "",
      activeTransition: active
        ? getComputedStyle(active).transitionDuration
        : "",
    };
  });

  expect(motion.routeAnimation).toBe("none");
  expect(motion.activeTransition).toBe("0s");
});
