import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const widths = [320, 375, 390, 430, 768, 1024];
const auditOutput = process.env.IRIDE_AUDIT_OUTPUT;

test.beforeEach(async ({ context }) => {
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
});

for (const width of widths) {
  test(
    "Home remains stable and operable at " + width + "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator('[data-ui="feature-selection"] a')).toHaveCount(
        3,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      if (auditOutput && (width === 390 || width === 1024)) {
        await mkdir(auditOutput, { recursive: true });
        await page.screenshot({
          fullPage: true,
          path: path.join(auditOutput, "home-" + width + ".png"),
        });
      }
    },
  );

  test(
    "Login remains stable and operable at " + width + "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/login?intent=profile");

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const google = page.getByRole("button", {
        name: "ดำเนินการต่อด้วย Google",
      });
      await expect(google).toBeVisible();
      const box = await google.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      if (auditOutput && (width === 390 || width === 1024)) {
        await mkdir(auditOutput, { recursive: true });
        await page.screenshot({
          fullPage: true,
          path: path.join(auditOutput, "login-" + width + ".png"),
        });
      }
    },
  );
}
