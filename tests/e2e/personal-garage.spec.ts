import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type {
  ServiceRecord,
  Vehicle,
  VehiclePhoto,
} from "../../apps/web/src/features/garage/types";
const vehicleId = "6d34bc84-8116-4ee5-b6db-c9204b90139b",
  recordId = "d9096a81-c4f8-4c4e-a340-3a0c67c488d2",
  photoId = "07c0ec20-9404-43c2-8311-7a3b8ffb89cc";
test("fullscreen hub has three accessible destinations and no viewport overflow", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const section of ["Garage", "Knowledge", "Games"])
    await expect(
      page.getByRole("link", { name: new RegExp(section) }).first(),
    ).toBeVisible();
  await expect.poll(() => page.locator("canvas").count()).toBe(1);
  expect(
    await page.evaluate(() => ({
      x: document.documentElement.scrollWidth <= innerWidth,
      y: document.documentElement.scrollHeight <= innerHeight,
    })),
  ).toEqual({ x: true, y: true });
  await page.screenshot({
    path: "output/playwright/hub-" + info.project.name + ".png",
  });
  await page.getByRole("link", { name: /02.*Knowledge/ }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(
    page.getByRole("link", { name: /เปิด Engine Simulator/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Garage CRUD and Drive photo UI work without login (mocked API)", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let vehicles: Vehicle[] = [],
    records: ServiceRecord[] = [],
    photos: VehiclePhoto[] = [];
  const image = await readFile("apps/web/public/samples/car-01.jpg");
  await page.route("**/api/garage/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace("/api/garage/", ""),
      method = request.method();
    let data: unknown = { ok: true },
      status = 200;
    if (path.endsWith("/content")) {
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: image,
      });
      return;
    }
    if (path === "vehicles" && method === "GET") data = vehicles;
    else if (path === "vehicles" && method === "POST") {
      const input = request.postDataJSON();
      const vehicle: Vehicle = {
        ...input,
        id: vehicleId,
        coverPhotoId: null,
        deleting: false,
        createdAt: new Date().toISOString(),
      };
      vehicles = [vehicle];
      data = vehicle;
      status = 201;
    } else if (path === "vehicles/" + vehicleId && method === "GET") {
      if (!vehicles.length) {
        status = 404;
        data = { error: { code: "NOT_FOUND" } };
      } else
        data = {
          vehicle: vehicles[0],
          services: {
            items: records,
            total: records.length,
            page: 1,
            pageSize: 8,
          },
          photos,
          totalCost: records.reduce((sum, r) => sum + (r.cost ?? 0), 0),
        };
    } else if (path === "vehicles/" + vehicleId && method === "PATCH") {
      vehicles = vehicles.map((v) => ({ ...v, ...request.postDataJSON() }));
      data = vehicles[0];
    } else if (path === "vehicles/" + vehicleId && method === "DELETE") {
      vehicles = [];
      records = [];
      photos = [];
    } else if (path.endsWith("/services") && method === "POST") {
      const record: ServiceRecord = {
        ...request.postDataJSON(),
        id: recordId,
        vehicleId,
        createdAt: new Date().toISOString(),
      };
      records = [record];
      data = record;
    } else if (path.endsWith("/services/" + recordId) && method === "PATCH") {
      records = records.map((r) => ({ ...r, ...request.postDataJSON() }));
      data = records[0];
    } else if (path.endsWith("/services/" + recordId) && method === "DELETE")
      records = [];
    else if (path.endsWith("/photos") && method === "POST") {
      const photo: VehiclePhoto = {
        id: photoId,
        vehicleId,
        driveFileId: "test-file",
        name: "car.jpg",
        mimeType: "image/jpeg",
        bytes: image.length,
        status: "ready",
        createdAt: new Date().toISOString(),
      };
      photos = [photo];
      vehicles[0]!.coverPhotoId = photoId;
      data = photo;
    } else if (path.endsWith("/photos/" + photoId) && method === "DELETE") {
      photos = [];
      vehicles[0]!.coverPhotoId = null;
    } else {
      status = 404;
      data = { error: { code: "NOT_FOUND" } };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/garage");
  await expect(page.getByText("Garage ว่างอยู่")).toBeVisible();
  await expect(
    page.getByAltText("รูปพาหนะตัวอย่างจาก Google Drive ภาพที่ 1"),
  ).toBeVisible();
  await page.getByRole("button", { name: "เพิ่มรถ", exact: true }).click();
  await page.getByLabel("ชื่อรถ", { exact: true }).fill("Weekend ride");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Weekend ride" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "เพิ่ม service", exact: true })
    .click();
  await page.getByLabel("รายการ service", { exact: true }).fill("Oil change");
  await page.getByLabel("วันที่", { exact: true }).fill("2026-10-11");
  await page.getByLabel("ค่าใช้จ่าย (บาท)", { exact: true }).fill("1500");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("Oil change", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "แก้ไข service", exact: true })
    .click();
  await page
    .getByLabel("รายการ service", { exact: true })
    .fill("Oil and filter");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("Oil and filter", { exact: true })).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "car.jpg", mimeType: "image/jpeg", buffer: image });
  await expect(page.getByText("บันทึกแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByAltText("car.jpg", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "output/playwright/garage-" + info.project.name + ".png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByText("Oil and filter", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ลบรถ", exact: true }).click();
  await page.getByRole("button", { name: "ลบรถ", exact: true }).last().click();
  await expect(page.getByText("Garage ว่างอยู่")).toBeVisible();
  expect(photos).toHaveLength(0);
  expect(records).toHaveLength(0);
  expect(errors).toEqual([]);
});
test("retained game and engine simulator load independently of accounts", async ({
  page,
}) => {
  await page.goto("/games/traffic-endless-ride");
  await expect(
    page.getByRole("heading", { name: /TRAFFIC\s+RIDE/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "เริ่มเกม", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /TRAFFIC\s+RIDE/ }),
  ).not.toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.goto("/knowledge/engine-simulator");
  await expect(
    page.getByRole("heading", { name: "Engine Simulator 3D", exact: true }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "บิดกุญแจสตาร์ท", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "ดับเครื่อง", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "ดับเครื่อง", exact: true }).click();
});

test("WebGL fallback stays usable with reduced motion and keyboard", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.includes("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByText("เลือกหมวดด้านล่างเพื่อเริ่มต้น")).toBeVisible();
  const destination = page.getByRole("link", { name: /03.*Games/ });
  await destination.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/games$/);
});
test("English preference persists across navigation and refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("en", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your ride. Your world." }),
  ).toBeVisible();
  await page.getByRole("link", { name: /01.*Garage/ }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add vehicle", exact: true }),
  ).toBeVisible();
});

test("selecting each 3D station navigates by mouse or touch", async ({
  page,
  isMobile,
}) => {
  // Software WebGL in Linux CI makes the three pointer scans slower.
  test.setTimeout(120000);
  for (const section of ["garage", "knowledge", "games"]) {
    await page.goto("/");
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    let point: { x: number; y: number } | null = null;
    for (let row = 3; row <= 8 && !point; row++)
      for (let column = 1; column <= 18 && !point; column++) {
        const x = bounds!.x + (bounds!.width * column) / 20,
          y = bounds!.y + (bounds!.height * row) / 10;
        await page.mouse.move(x, y);
        if (
          (await page
            .locator(`nav a[href="/${section}"]`)
            .getAttribute("data-active")) === "true"
        )
          point = { x, y };
      }
    expect(point, "model can be selected: " + section).not.toBeNull();
    if (isMobile) await page.touchscreen.tap(point!.x, point!.y);
    else await page.mouse.click(point!.x, point!.y);
    await expect(page).toHaveURL(new RegExp("/" + section + "$"));
  }
});
