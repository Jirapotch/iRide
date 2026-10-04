import { expect, test } from "@playwright/test";

test("embedded touch rotates horizontally and permits vertical page scrolling", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Native touch gestures use Chromium's input protocol",
  );
  await page.setViewportSize({ width: 390, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const input = await page.context().newCDPSession(page);
  await input.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await page.goto("/");
  const hub = page.locator('[data-ui="ride-hub"]');
  await expect(hub).toHaveAttribute("data-scene-status", "ready", {
    timeout: 30000,
  });
  const plaque = hub.locator('[data-feature="trips"]');
  const before = await plaque.evaluate((el) => el.getBoundingClientRect().left);
  async function swipe(from: [number, number], to: [number, number]) {
    await input.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from[0], y: from[1] }],
    });
    for (let i = 1; i <= 6; i++)
      await input.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: from[0] + ((to[0] - from[0]) * i) / 6,
            y: from[1] + ((to[1] - from[1]) * i) / 6,
          },
        ],
      });
    await input.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  const canvas = await hub.locator("canvas").boundingBox();
  const dragY = canvas!.y + canvas!.height * 0.15;
  await swipe(
    [canvas!.x + canvas!.width * 0.25, dragY],
    [canvas!.x + canvas!.width * 0.7, dragY],
  );
  await expect
    .poll(() =>
      plaque.evaluate(
        (el, start) => Math.abs(el.getBoundingClientRect().left - start),
        before,
      ),
    )
    .toBeGreaterThan(3);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await swipe(
    [canvas!.x + canvas!.width * 0.85, canvas!.y + canvas!.height * 0.75],
    [canvas!.x + canvas!.width * 0.85, canvas!.y + canvas!.height * 0.2],
  );
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await input.detach();
});

for (const [width, height] of [
  [1440, 900],
  [1024, 768],
  [390, 844],
  [360, 800],
]) {
  test(`interactive platform fits and navigates at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: width!, height: height! });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const hub = page.locator('[data-ui="ride-hub"]');
    await expect(hub).toHaveAttribute("data-scene-status", "ready", {
      timeout: 30000,
    });
    await expect(hub.locator("canvas")).toBeVisible();
    const buttons = hub.locator("[data-ride-feature]");
    await expect(buttons).toHaveCount(6);
    await expect(
      page.getByRole("button", { name: /Choose camera view|เลือกมุมมอง/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("radiogroup", { name: /Scene mode|โหมดฉาก/ }),
    ).toHaveCount(0);
    await expect(page.locator('[data-ui="feature-selection"]')).toHaveCount(0);
    for (const button of await buttons.all()) {
      const size = await button.boundingBox();
      expect(size!.height).toBeGreaterThanOrEqual(44);
      expect(size!.width).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await buttons.filter({ hasText: /Routes|เส้นทาง/ }).click();
    await expect(hub.locator('a[href="/maps"]')).toBeVisible();
    await hub.locator('[data-ride-feature="knowledge"]').click();
    await expect(hub.locator('[data-feature="knowledge"]')).toBeVisible();
    await expect(hub.locator('a[href="/knowledge"]')).toBeVisible();
    await hub.locator('[data-ride-feature="trips"]').click();
    await hub.locator('a[href="/activities?kinds=trip"]').click();
    await expect(page).toHaveURL(/\/activities\?kinds=trip$/);
    expect(errors).toEqual([]);
  });
}

test("keyboard selection, reduced motion and dark theme remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("iride-theme", "dark"));
  await page.goto("/");
  const hub = page.locator('[data-ui="ride-hub"]');
  await expect(hub).toHaveAttribute("data-scene-status", "ready", {
    timeout: 30000,
  });
  await hub.locator('[data-ride-feature="games"]').focus();
  await page.keyboard.press("Enter");
  await expect(hub.locator('a[href="/games"]')).toBeVisible();
  await page
    .getByRole("button", { name: /Reset view|กลับมุมเริ่มต้น/ })
    .click();
  await expect(hub.locator('[data-ride-feature="games"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("WebGL failure retains feature navigation and retry", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  const hub = page.locator('[data-ui="ride-hub"]');
  await expect(hub).toHaveAttribute("data-scene-status", "error", {
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: /Retry|ลองอีกครั้ง/ }),
  ).toBeVisible();
  await hub.locator('[data-ride-feature="community"]').click();
  await hub.locator('a[href="/community"]').click();
  await expect(page).toHaveURL(/\/community$/);
});

test("manual orbit preserves feature selection without a camera menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const hub = page.locator('[data-ui="ride-hub"]');
  await expect(hub).toHaveAttribute("data-scene-status", "ready", {
    timeout: 30000,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const plaque = hub.locator('[data-feature="trips"]');
  const before = await plaque.evaluate((el) => el.getBoundingClientRect().left);
  const canvas = await hub.locator("canvas").boundingBox();
  await page.mouse.move(canvas!.x + 100, canvas!.y + 140);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + 250, canvas!.y + 140, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(() =>
      plaque.evaluate(
        (el, start) => Math.abs(el.getBoundingClientRect().left - start),
        before,
      ),
    )
    .toBeGreaterThan(3);
  await expect(hub.locator('[data-ride-feature="trips"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
