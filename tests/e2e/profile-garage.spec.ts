import { expect, test } from "@playwright/test";
import type {
  OwnProfileDto,
  OwnerVehicleDto,
  VehicleRecordDto,
  VehicleDocumentDto,
} from "@iride/types";

const ownerId = "11111111-1111-4111-8111-111111111111";
const now = "2026-10-04T00:00:00Z";
const profile: OwnProfileDto = {
  id: ownerId,
  username: "e2e_rider",
  displayName: "E2E Rider",
  bio: "Weekend rides",
  avatarMediaId: null,
  coverMediaId: null,
  locationName: "Bangkok",
  latitude: null,
  longitude: null,
  visibility: "public",
  role: "user",
  status: "active",
  canWrite: true,
  canManage: false,
  isComplete: true,
  usernameChangeAvailableAt: null,
  createdAt: now,
  updatedAt: now,
};
const originalVehicle: OwnerVehicleDto = {
  id: "33333333-3333-4333-8333-333333333333",
  owner: { id: ownerId, username: "e2e_rider", displayName: "E2E Rider" },
  kind: "motorcycle",
  brand: "Honda",
  model: "CB500",
  year: 2024,
  nickname: "Daily ride",
  description: "My motorcycle",
  visibility: "private",
  mediaIds: [],
  canEdit: true,
  createdAt: now,
  updatedAt: now,
  mileageKm: 10000,
  nextServiceKm: 12000,
  nextServiceDate: "2026-11-01",
  archivedAt: null,
  recordCount: 1,
  pendingTransfer: null,
};

test.beforeEach(async ({ context, page }) => {
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
    {
      name: "iride-locale",
      value: "en",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  let vehicle = { ...originalVehicle };
  let records: VehicleRecordDto[] = [
    {
      id: "record-1",
      vehicleId: vehicle.id,
      vehicleLabel: "Daily ride",
      kind: "service",
      title: "Oil change",
      occurredOn: "2026-10-01",
      mileageKm: 10000,
      workshopName: "Local shop",
      description: "New oil",
      documentIds: ["doc-1"],
      createdAt: now,
      updatedAt: now,
    },
  ];
  let documents: VehicleDocumentDto[] = [
    {
      id: "doc-1",
      vehicleId: vehicle.id,
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      bytes: 1024,
      recordId: "record-1",
      createdAt: now,
    },
    {
      id: "doc-2",
      vehicleId: vehicle.id,
      filename: "private.pdf",
      mimeType: "application/pdf",
      bytes: 2048,
      recordId: null,
      createdAt: now,
    },
  ];
  let failRecord = true;
  let failImageAttachment = true;
  await page.route("**/api/bff/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace("/api/bff", "");
    const method = request.method();
    const fulfill = (data: unknown) => route.fulfill({ json: { data } });
    if (pathname === "/profile/me") return fulfill(profile);
    if (pathname === "/profile/me/garage-summary")
      return fulfill({
        vehicles: [vehicle],
        recentRecords: records,
        transfers: [],
      });
    if (pathname === "/vehicles/33333333-3333-4333-8333-333333333333/records") {
      if (method === "POST") {
        if (failRecord) {
          failRecord = false;
          return route.fulfill({
            status: 503,
            json: { error: { code: "GARAGE_UNAVAILABLE" } },
          });
        }
        const record: VehicleRecordDto = {
          ...request.postDataJSON(),
          id: "record-2",
          vehicleId: vehicle.id,
          vehicleLabel: "Daily ride",
          documentIds: [],
          createdAt: now,
          updatedAt: now,
        };
        records = [record, ...records];
        vehicle = { ...vehicle, recordCount: records.length };
        return fulfill(record);
      }
      return fulfill(records);
    }
    if (
      pathname === "/vehicles/33333333-3333-4333-8333-333333333333/documents"
    ) {
      if (method === "POST") {
        if (request.headers()["content-type"]?.startsWith("application/json")) {
          const input = request.postDataJSON();
          expect(input.mediaId).toBe("44444444-4444-4444-8444-444444444444");
          expect(input.filename).toBe("receipt-photo.png");
          if (failImageAttachment) {
            failImageAttachment = false;
            return route.fulfill({
              status: 503,
              json: { error: { code: "GARAGE_UNAVAILABLE" } },
            });
          }
          const document: VehicleDocumentDto = {
            id: "doc-image",
            vehicleId: vehicle.id,
            filename: input.filename,
            mimeType: "image/webp",
            bytes: 300,
            recordId: input.recordId,
            createdAt: now,
          };
          documents = [...documents, document];
          return fulfill(document);
        }
        const document: VehicleDocumentDto = {
          id: "doc-3",
          vehicleId: vehicle.id,
          filename: "upload.pdf",
          mimeType: "application/pdf",
          bytes: 7,
          recordId: null,
          createdAt: now,
        };
        documents = [...documents, document];
        return fulfill(document);
      }
      return fulfill(documents);
    }
    if (pathname === "/vehicles/33333333-3333-4333-8333-333333333333/archive") {
      vehicle = {
        ...vehicle,
        archivedAt: request.postDataJSON().archived ? now : null,
      };
      return fulfill(vehicle);
    }
    return route.continue();
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`owner garage query, history, documents and forms work in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(
      (mode) => localStorage.setItem("iride-theme", mode),
      theme,
    );
    await page.goto(
      "/users/e2e_rider?tab=garage&vehicle=33333333-3333-4333-8333-333333333333&section=documents",
    );
    await expect(page).toHaveURL(
      /\/profile\?tab=garage&vehicle=33333333-3333-4333-8333-333333333333&section=documents$/,
    );
    await expect(
      page.getByRole("heading", { name: "E2E Rider", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /receipt.pdf/ })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator('[data-profile-tab="garage"]').click();
    await expect(page).toHaveURL(/\/profile\?tab=garage$/);
    await expect(
      page.getByRole("heading", { name: "My garage" }),
    ).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("link", { name: /receipt.pdf/ })).toBeVisible();
    for (const button of await page
      .locator("article button:visible, article a.ant-btn:visible")
      .all()) {
      const box = await button.boundingBox();
      expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
    }
    await page.locator('[data-profile-tab="overview"]').click();
    await expect(page.locator('[data-profile-tab="overview"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByText("Recent records", { exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("link", { name: /receipt.pdf/ })).toBeVisible();
    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Oil change/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Add record", exact: true }).click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Title", { exact: true }).fill("Chain adjustment");
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await expect(modal.getByRole("alert")).toContainText("Could not save");
    await expect(modal.getByLabel("Title", { exact: true })).toHaveValue(
      "Chain adjustment",
    );
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Chain adjustment/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await page
      .locator('input[type="file"][accept="application/pdf"]')
      .setInputFiles({
        name: "upload.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("receipt"),
      });
    await page.getByRole("button", { name: "Upload PDF", exact: true }).click();
    await expect(page.getByRole("link", { name: /upload.pdf/ })).toBeVisible();
    await page.getByRole("link", { name: "Report", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("checkbox", { name: "receipt.pdf", exact: true })
      .check();
    await expect(page.locator("#garage-report")).toContainText("receipt.pdf");
    await expect(page.locator("#garage-report")).not.toContainText(
      "private.pdf",
    );
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#garage-report")).toBeVisible();
    await expect(page.locator("#garage-report")).toContainText(
      "Chain adjustment",
    );
    await page.emulateMedia({ media: "screen" });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.screenshot({
      path: testInfo.outputPath(`garage-${theme}.png`),
      fullPage: true,
    });
  });
}

test("another rider stays on public identity route without owner controls", async ({
  page,
}) => {
  await page.goto("/users/other_rider?tab=garage");
  await expect(page).toHaveURL(/\/users\/other_rider\?tab=garage$/);
  await expect(
    page.getByRole("heading", { name: "Other Rider", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add vehicle", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
});

test("Thai profile uses localized form validation and confirmation controls", async ({
  context,
  page,
}) => {
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
  await page.goto(
    "/profile?tab=garage&vehicle=33333333-3333-4333-8333-333333333333&modal=add-record",
  );
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(modal).toContainText("กรุณากรอกหัวข้อ");
  await modal.getByRole("button", { name: /Close|ปิด/ }).click();
  await expect(modal).toBeHidden();
  await page.getByRole("button", { name: "เก็บถาวร", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ยกเลิก", exact: true }),
  ).toBeVisible();
});

test("private document images reuse WebP pipeline and preserve selected file on attachment retry", async ({
  page,
}) => {
  await page.request.post(
    `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}/test/media-requests`,
    { data: {} },
  );
  let storageUploads = 0;
  await page.route("**/storage/v1/object/upload/sign/**", async (route) => {
    if (route.request().method() !== "OPTIONS") {
      storageUploads += 1;
      expect(route.request().postDataBuffer()?.toString("latin1")).toContain(
        "image/webp",
      );
    }
    return route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "PUT, POST, OPTIONS",
        "access-control-allow-headers":
          "authorization, apikey, x-client-info, content-type, x-upsert",
      },
      json: { Key: "media-originals/processed-document" },
    });
  });
  await page.goto(
    "/profile?tab=garage&vehicle=33333333-3333-4333-8333-333333333333&section=documents",
  );
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 200;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, 100, 200);
    context.fillStyle = "black";
    context.fillText("Receipt", 10, 30);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  const uploader = page.locator('[data-media-purpose="vehicle_document"]');
  await uploader.locator('input[type="file"]').setInputFiles({
    name: "receipt-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(encoded, "base64"),
  });
  await uploader.getByRole("button", { name: "Upload this image" }).click();
  await expect(uploader.getByRole("status")).toContainText("Upload failed");
  await expect(uploader.getByAltText("Selected image preview")).toBeVisible();
  await uploader.getByRole("button", { name: "Upload this image" }).click();
  await expect(
    page.getByRole("link", { name: /receipt-photo.png/ }),
  ).toBeVisible();
  expect(storageUploads).toBe(1);
  const activity = (
    await (
      await page.request.get(
        `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}/test/media-requests`,
      )
    ).json()
  ).data;
  expect(activity.requests).toHaveLength(1);
  expect(activity.requests[0]).toMatchObject({
    purpose: "vehicle_document",
    vehicleId: "33333333-3333-4333-8333-333333333333",
    mimeType: "image/webp",
  });
  expect(activity.completedImages).toBeGreaterThanOrEqual(3);
});

test("garage card opens Add record directly and More menu report, edit and transfer routes", async ({
  page,
}) => {
  await page.goto("/profile?tab=garage");
  await page.getByRole("link", { name: "Add record", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Vehicle record" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.locator('[data-profile-tab="garage"]').click();
  await page.getByRole("button", { name: "More Daily ride" }).click();
  await page.getByRole("menuitem", { name: "Sale report" }).click();
  await expect(
    page.getByRole("dialog", { name: "Vehicle report" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  for (const [label, modal] of [
    ["Edit vehicle", "Edit vehicle"],
    ["Transfer", "Transfer ownership"],
  ]) {
    await page.locator('[data-profile-tab="garage"]').click();
    await page.getByRole("button", { name: "More Daily ride" }).click();
    await page.getByRole("menuitem", { name: label }).click();
    await expect(page.getByRole("dialog", { name: modal })).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
  }
});
