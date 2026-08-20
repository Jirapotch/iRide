import type { Locale } from "@/lib/types";

export function ImageUploadHint({ locale }: { locale: Locale }) {
  return <p className="mt-2 text-xs text-muted-foreground">
    {locale === "th"
      ? "JPEG, PNG หรือ WebP · ไฟล์ต้นฉบับไม่เกิน 8 MB · บันทึกเป็น WebP ต่ำกว่า 3 MB"
      : "JPEG, PNG or WebP · source max 8 MB · stored as WebP under 3 MB"}
  </p>;
}
