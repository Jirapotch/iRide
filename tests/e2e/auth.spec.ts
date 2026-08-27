import { expect, test } from "@playwright/test";

for (const locale of ["th", "en"] as const) {
  test(`completes Google OAuth, API authentication, and logout in ${locale}`, async ({
    context,
    page,
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

    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);

    await page.getByRole("button", { name: /Google/ }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText("@e2e_rider")).toBeVisible();
    await expect(page.locator('[data-ui="app-shell"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: /จัดการตัวตนบน iRide|Manage your iRide identity/ })).toBeVisible();

    const authCookies = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith("iride-auth"),
    );
    expect(authCookies.length).toBeGreaterThan(0);
    expect(authCookies.every((cookie) => cookie.httpOnly)).toBe(true);
    expect(authCookies.every((cookie) => cookie.sameSite === "Lax")).toBe(true);

    await page.getByRole("button", { name: /ตั้งค่า|Settings/ }).click();
    await page.getByRole("button", { name: /ออกจากระบบ|Sign out/ }).click();
    await expect(page).toHaveURL(/\/login\?signed_out=1/);
    expect(
      (await context.cookies()).filter((cookie) =>
        cookie.name.startsWith("iride-auth"),
      ),
    ).toHaveLength(0);
    expect(
      (await context.cookies()).find((cookie) => cookie.name === "iride-locale")
        ?.value,
    ).toBe(locale);
  });
}

test("sanitizes callback destinations and localizes provider errors", async ({
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

  await page.goto("/login?next=https://evil.example/stolen");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/auth/callback?error=access_denied");
  await expect(page).toHaveURL(/\/login\?error=provider$/);
  await expect(page.getByRole("status")).toContainText(
    "Google sign-in is unavailable",
  );
});

test("returns to the protected profile after sign-in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);

  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "RiderXplorer",
  );
});
