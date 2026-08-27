import { expect, test } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";

for (const locale of ["th", "en"] as const) {
  test(`completes Google OAuth, API authentication, and logout in ${locale}`, async ({
    context,
    page,
  }) => {
    await page.goto(`/${locale}/account`);
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/login\\?next=%2F${locale}%2Faccount`),
    );

    await page.getByRole("button", { name: /Google/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
    await expect(page.getByText(userId)).toBeVisible();
    await expect(page.getByText(/API (ยืนยันตัวตนสำเร็จ|authentication succeeded)/)).toBeVisible();

    const authCookies = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith("iride-auth"),
    );
    expect(authCookies.length).toBeGreaterThan(0);
    expect(authCookies.every((cookie) => cookie.httpOnly)).toBe(true);
    expect(authCookies.every((cookie) => cookie.sameSite === "Lax")).toBe(true);

    await page.getByRole("button", { name: /ออกจากระบบ|Sign out/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?signed_out=1`));
    expect(
      (await context.cookies()).filter((cookie) =>
        cookie.name.startsWith("iride-auth"),
      ),
    ).toHaveLength(0);
  });
}

test("sanitizes callback destinations and localizes provider errors", async ({
  page,
}) => {
  await page.goto("/th/login?next=https://evil.example/stolen");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/th\/account$/);

  await page.goto("/en/auth/callback?error=access_denied");
  await expect(page).toHaveURL(/\/en\/login\?error=provider$/);
  await expect(page.getByRole("status")).toContainText(
    "Google sign-in is unavailable",
  );
});
