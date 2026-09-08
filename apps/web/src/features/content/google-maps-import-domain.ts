import type { GoogleMapsResolveErrorCode } from "@/lib/google-maps-resolver";
import type { Locale } from "@/lib/locale";

export function googleMapsImportErrorMessage(
  code: GoogleMapsResolveErrorCode,
  locale: Locale,
) {
  const messages = {
    en: {
      "invalid-url": "Enter a valid Google Maps URL.",
      "unsupported-host": "This is not a supported Google Maps link.",
      "directions-url":
        "Share one Google Maps place instead of a directions route.",
      "redirect-failed": "The short Google Maps link could not be resolved.",
      timeout: "Checking the link took too long. Please try again.",
      "no-coordinates": "No coordinates were found in this Google Maps link.",
    },
    th: {
      "invalid-url": "กรุณากรอก URL ของ Google Maps ที่ถูกต้อง",
      "unsupported-host": "ลิงก์นี้ไม่ใช่ลิงก์ Google Maps ที่รองรับ",
      "directions-url": "กรุณาแชร์สถานที่หนึ่งจุด แทนลิงก์เส้นทาง",
      "redirect-failed": "ไม่สามารถเปิดลิงก์ Google Maps แบบสั้นได้",
      timeout: "ใช้เวลาตรวจสอบลิงก์นานเกินไป กรุณาลองอีกครั้ง",
      "no-coordinates": "ไม่พบพิกัดในลิงก์ Google Maps นี้",
    },
  } as const;
  return messages[locale][code];
}
