import { expect, test } from "@playwright/test";

const mockUrl = "http://127.0.0.1:54321";

for (const locale of ["th", "en"] as const) {
  test(`onboards, edits, and protects a profile in ${locale}`, async ({
    context,
    page,
    request,
  }) => {
    await request.post(`${mockUrl}/test/profiles/reset`, {
      data: { complete: false },
    });
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

    await page.goto("/login?intent=profile");
    await page.getByRole("button", { name: /Google/ }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.locator('[data-ui="standalone-shell"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /ออกจากระบบ|Sign out/ }),
    ).toBeVisible();

    await page.getByLabel(/ชื่อผู้ใช้|Username/).fill(`rider_${locale}`);
    await page
      .getByLabel(/ชื่อที่แสดง|Display name/)
      .fill(locale === "th" ? "นักขับทดสอบ" : "Test Rider");
    await page.getByLabel(/แนะนำตัว|Bio/).fill("Roads and stories");
    await page.getByLabel(/พื้นที่หรือเมือง|Area or city/).fill("Bangkok");
    await page
      .getByRole("button", { name: /บันทึกโปรไฟล์|Save profile/ })
      .click();

    await expect(page).toHaveURL(new RegExp(`/users/rider_${locale}$`));
    await expect(page.locator('[data-ui="app-shell"]')).toBeVisible();
    await expect(page.getByText(`@rider_${locale}`)).toBeVisible();
    await expect(page.getByText("Roads and stories")).toBeVisible();
    await page.getByRole("button", { name: /ตั้งค่า|Settings/ }).click();
    await expect(
      page.getByRole("button", { name: /ออกจากระบบ|Sign out/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /ปิด|Close/ }).click();

    await page.getByRole("button", { name: /แก้ไขโปรไฟล์|Edit profile/ }).click();
    await page
      .getByLabel(/การมองเห็นโปรไฟล์|Profile visibility/)
      .selectOption("private");
    await page
      .getByRole("button", { name: /บันทึกโปรไฟล์|Save profile/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`/users/rider_${locale}$`));

    await page.reload();
    await expect(page.getByRole("button", { name: /แก้ไขโปรไฟล์|Edit profile/ })).toBeVisible();
    await page.getByRole("button", { name: /ตั้งค่า|Settings/ }).click();
    await page.getByRole("button", { name: /ออกจากระบบ|Sign out/ }).click();
    await expect(page).toHaveURL(/\/login\?signed_out=1/);
    const apiPort = process.env.E2E_API_PORT ?? "3001";
    const hiddenApi = await request.get(
      `http://127.0.0.1:${apiPort}/api/v1/users/rider_${locale}`,
    );
    expect(hiddenApi.status()).toBe(404);
    await page.goto(`/users/rider_${locale}`);
    await expect(page.getByText(`@rider_${locale}`)).not.toBeVisible();
  });
}

test("shows duplicate and cooldown username errors", async ({
  context,
  page,
  request,
}) => {
  await request.post(`${mockUrl}/test/profiles/reset`, {
    data: { complete: false },
  });
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
  await page.goto("/login?intent=profile");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Display name").fill("Reserved Rider");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByLabel("Username")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByText("That username is reserved.")).toBeVisible();

  await page.getByLabel("Username").fill("taken_name");
  await page.getByLabel("Display name").fill("Taken Rider");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("already in use");

  await page.getByLabel("Username").fill("first_name");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Username").fill("second_name");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("30 days");
});

test("signs out from onboarding and hides the action when anonymous", async ({
  context,
  page,
  request,
}) => {
  await request.post(`${mockUrl}/test/profiles/reset`, {
    data: { complete: false },
  });
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

  await page.goto("/login?intent=profile");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?signed_out=1$/);

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("keeps sign out available inside settings at mobile and desktop widths", async ({
  context,
  page,
  request,
}) => {
  await request.post(`${mockUrl}/test/profiles/reset`, {
    data: { complete: true },
  });
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

  await page.goto("/login?intent=profile");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  const signOut = page.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(signOut).toBeVisible();
});
