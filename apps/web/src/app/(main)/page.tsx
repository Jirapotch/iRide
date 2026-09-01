import { Bicycle, Camera, Car, Motorcycle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { getRequestLocale } from "@/lib/request-locale";

const categories = [
  { href: "/community/car", key: "car", icon: Car },
  { href: "/community/motorcycle", key: "motorcycle", icon: Motorcycle },
  { href: "/community/bicycle", key: "bicycle", icon: Bicycle },
  { href: "/community/photographers", key: "photographers", icon: Camera },
  { href: "/community/groups", key: "groups", icon: UsersThree },
] as const;

const labels = {
  th: { heading: "เลือกพื้นที่ของคุณ", intro: "พบปะ แลกเปลี่ยน และออกเดินทางกับผู้คนที่ชอบสิ่งเดียวกัน", car: "รถยนต์", motorcycle: "มอเตอร์ไซค์", bicycle: "จักรยาน", photographers: "ช่างภาพ", groups: "กลุ่ม" },
  en: { heading: "Choose your space", intro: "Meet, share, and explore with people who enjoy the same things.", car: "Cars", motorcycle: "Motorcycles", bicycle: "Bicycles", photographers: "Photographers", groups: "Groups" },
} as const;

export default async function HomePage() {
  const locale = await getRequestLocale();
  const text = labels[locale];
  return (
    <main className="community-home">
      <header className="community-home-heading"><h1>{text.heading}</h1><p>{text.intro}</p></header>
      <div className="community-category-grid">
        {categories.map(({ href, icon: Icon, key }) => (
          <Link className={`community-category-card is-${key}`} href={href} key={key}>
            <span><Icon aria-hidden size={42} weight="duotone" /></span><strong>{text[key]}</strong>
          </Link>
        ))}
      </div>
    </main>
  );
}
