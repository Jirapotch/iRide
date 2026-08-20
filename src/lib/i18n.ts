import { notFound } from "next/navigation";
import type { Locale } from "@/lib/types";

export const locales = ["th", "en"] as const;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function assertLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}

const dictionaries = {
  th: {
    nav: { feed: "ฟีด", garage: "โรงรถ", profile: "โปรไฟล์", signIn: "เข้าสู่ระบบ", newPost: "สร้างโพสต์" },
    landing: {
      eyebrow: "พื้นที่ของคนรักรถ",
      title: "ทุกการเดินทาง มีเรื่องราว",
      description: "แชร์รถคันโปรด บันทึกโมเมนต์บนท้องถนน และพบเพื่อนที่หลงใหลในการขับขี่เหมือนกัน",
      primary: "เข้าร่วม iRide",
      secondary: "ดูชุมชน",
    },
    feed: { title: "Community", subtitle: "เรื่องราวล่าสุดจากคนรักรถ", composer: "วันนี้รถของคุณมีเรื่องอะไร?" },
    common: { like: "ถูกใจ", comment: "ความคิดเห็น", follow: "ติดตาม", following: "กำลังติดตาม", garage: "Garage" },
  },
  en: {
    nav: { feed: "Feed", garage: "Garage", profile: "Profile", signIn: "Sign in", newPost: "New post" },
    landing: {
      eyebrow: "A place for people who love cars",
      title: "Every ride has a story",
      description: "Share your favorite car, capture moments on the road, and meet people who love the drive as much as you do.",
      primary: "Join iRide",
      secondary: "Explore community",
    },
    feed: { title: "Community", subtitle: "Fresh stories from people who love cars", composer: "What happened with your ride today?" },
    common: { like: "Like", comment: "Comments", follow: "Follow", following: "Following", garage: "Garage" },
  },
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
