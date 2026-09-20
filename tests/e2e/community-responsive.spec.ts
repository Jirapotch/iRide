import { expect, test } from "@playwright/test";

for (const locale of ["en", "th"]) {
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    test(`community cards remain readable at ${width}px in ${locale}`, async ({
      page,
      context,
    }) => {
      await context.addCookies([
        {
          name: "iride-locale",
          value: locale,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/community");

      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const cards = page.locator("article");
      await expect(cards).toHaveCount(4);
      const measurements = await cards.evaluateAll((elements) =>
        elements.map((card) => {
          const title = card.querySelector("h2")!;
          const link = card.querySelector("a")!;
          const bounds = link.getBoundingClientRect();
          return {
            titleClipped: title.scrollWidth > title.clientWidth + 1,
            linkClipped: link.scrollWidth > link.clientWidth + 1,
            targetWidth: bounds.width,
            targetHeight: bounds.height,
          };
        }),
      );
      for (const measurement of measurements) {
        expect(measurement.titleClipped).toBe(false);
        expect(measurement.linkClipped).toBe(false);
        expect(measurement.targetWidth).toBeGreaterThanOrEqual(44);
        expect(measurement.targetHeight).toBeGreaterThanOrEqual(44);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }
}
