import { expect, it } from "vitest";

import { googleMapsImportErrorMessage } from "./google-maps-import-domain";

it("maps resolver errors to specific localized guidance", () => {
  expect(googleMapsImportErrorMessage("invalid-url", "en")).toBe(
    "Enter a valid Google Maps URL.",
  );
  expect(googleMapsImportErrorMessage("unsupported-host", "th")).toBe(
    "ลิงก์นี้ไม่ใช่ลิงก์ Google Maps ที่รองรับ",
  );
  expect(googleMapsImportErrorMessage("no-coordinates", "en")).toBe(
    "No coordinates were found in this Google Maps link.",
  );
  expect(googleMapsImportErrorMessage("timeout", "th")).toBe(
    "ใช้เวลาตรวจสอบลิงก์นานเกินไป กรุณาลองอีกครั้ง",
  );
  expect(googleMapsImportErrorMessage("redirect-failed", "th")).toBe(
    "ไม่สามารถเปิดลิงก์ Google Maps แบบสั้นได้",
  );
});
