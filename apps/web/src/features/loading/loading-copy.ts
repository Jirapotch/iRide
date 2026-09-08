import type { Locale } from "@/lib/locale";

export type LoadingSurface =
  | "community"
  | "profile"
  | "admin-list"
  | "admin-detail"
  | "create"
  | "map"
  | "games"
  | "game"
  | "shell";

const labels: Record<Locale, Record<LoadingSurface, string>> = {
  th: {
    community: "กำลังโหลดเรื่องราวในชุมชน",
    profile: "กำลังโหลดโปรไฟล์",
    "admin-list": "กำลังโหลดรายชื่อผู้ใช้",
    "admin-detail": "กำลังโหลดรายละเอียดผู้ใช้",
    create: "กำลังเตรียมแบบฟอร์ม",
    map: "กำลังโหลดแผนที่และกิจกรรม",
    games: "กำลังโหลดรายการเกมส์",
    game: "กำลังเตรียมเกมส์",
    shell: "กำลังเตรียมพื้นที่ iRide",
  },
  en: {
    community: "Loading community stories",
    profile: "Loading profile",
    "admin-list": "Loading users",
    "admin-detail": "Loading user details",
    create: "Loading create form",
    map: "Loading map and activities",
    games: "Loading games",
    game: "Loading game",
    shell: "Loading iRide",
  },
};

export function getLoadingLabel(
  locale: Locale,
  surface: LoadingSurface,
): string {
  return labels[locale][surface];
}
