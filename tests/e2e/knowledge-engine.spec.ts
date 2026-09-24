import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "iride-locale",
      value: "en",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "sb-iride-auth-token",
      value: "existing-session-cookie",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test("knowledge routes stay local and expose the interactive engine", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/knowledge");
  await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
  await page.getByRole("link", { name: /Open Engine Simulator 3D/ }).click();
  await expect(
    page.getByRole("heading", { name: "Engine Simulator 3D" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Category" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Engine" })).toBeVisible();
  await expect(
    page.locator('[data-ui="engine-simulator"] canvas'),
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(
    requests.filter(
      (url) => new URL(url).origin !== origin || /\/api\//.test(url),
    ),
  ).toEqual([]);
});

test("old Learning links redirect to Knowledge", async ({ page }) => {
  await page.goto("/learning");
  await expect(page).toHaveURL(/\/knowledge$/);
  await page.goto("/learning/engine-simulator");
  await expect(page).toHaveURL(/\/knowledge\/engine-simulator$/);
});

test("Thai knowledge pages fit the viewport", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "iride-locale",
      value: "th",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/knowledge");
  await expect(
    page.getByRole("heading", { name: "สื่อความรู้" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /เปิด Engine Simulator 3D/ }).click();
  await expect(page.getByRole("combobox", { name: "ประเภท" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});

test("engine audio starts from a click and follows the selected engine", async ({
  page,
}) => {
  await page.goto("/knowledge/engine-simulator");
  const hasAudioContext = await page.evaluate(() =>
    Boolean(
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext,
    ),
  );
  await expect(
    page.locator('[data-ui="engine-simulator"] canvas'),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Category" }).selectOption("v");
  await page.getByRole("combobox", { name: "Engine" }).selectOption("v8x");
  await expect(
    page.getByRole("heading", { name: "V8 90° crossplane" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByRole("button", { name: "Track" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Slow motion" }).click();
  await expect(page.getByRole("button", { name: "Pause view" })).toBeVisible();
  await page.getByRole("slider", { name: "Crank angle" }).press("End");
  await expect(page.getByRole("slider", { name: "Crank angle" })).toHaveValue(
    "720",
  );
  await page.getByRole("button", { name: "Start engine" }).click();
  if (!hasAudioContext) {
    await expect(
      page.getByText("Audio could not start in this browser.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Stop engine" }),
    ).toBeVisible();
    return;
  }
  await expect(page.locator('[data-ui="engine-simulator"]')).toHaveAttribute(
    "data-audio-ready",
    "true",
  );
  await expect(page.getByRole("button", { name: "Stop engine" })).toBeVisible();
  await page.getByRole("slider", { name: /Throttle/ }).press("End");
  await expect(page.getByRole("meter", { name: "RPM" })).not.toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.getByRole("button", { name: "Stop engine" }).click();
  await expect(page.locator('[data-ui="engine-simulator"]')).toHaveAttribute(
    "data-audio-ready",
    "false",
  );
});

test("reduced motion opens on a paused cutaway", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/knowledge/engine-simulator");
  await expect(
    page.locator('[data-ui="engine-simulator"] canvas'),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Live view" })).toBeVisible();
  await page.getByRole("button", { name: "Start engine" }).click();
  await expect(page.getByRole("button", { name: "Live view" })).toBeVisible();
});
