import Image from "next/image";

import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getRequestLocale } from "@/lib/request-locale";
import { Breadcrumbs } from "../_components/breadcrumbs";
import styles from "../_components/home/home.module.css";

const copy = {
  th: {
    preview: "ตัวอย่าง",
    soon: "เร็ว ๆ นี้",
    body: "สัมผัสเส้นทางที่ไม่มีที่สิ้นสุด ผ่านจังหวะการขับขี่และการตัดสินใจ เกมเพลย์และระบบคะแนนกำลังอยู่ระหว่างการพัฒนา",
  },
  en: {
    preview: "Preview",
    soon: "Coming soon",
    body: "Experience an endless road shaped by rhythm and decisions. Gameplay and scoring are still in development.",
  },
} as const;

export default async function GamesPage() {
  const locale = await getRequestLocale();
  const text = copy[locale];

  return (
    <main className={styles.gameShowcase}>
      <Image
        alt={
          locale === "th"
            ? "รถยนต์สีเข้มกำลังแล่นบนถนนกลางป่ายามพลบค่ำ"
            : "A dark vehicle following an open forest road at dusk"
        }
        className={styles.gameImage}
        fill
        priority
        sizes="100vw"
        src="/home/game-road.png"
      />
      <span aria-hidden="true" className={styles.gameVeil} />
      <div className={styles.gameShowcaseContent}>
        <Breadcrumbs
          items={resolveBreadcrumbs("/games", { locale })}
          locale={locale}
        />
        <span className={styles.previewBadge}>{text.preview}</span>
        <h1 data-route-heading tabIndex={-1}>
          Traffic Endless Ride
        </h1>
        <p>{text.body}</p>
        <div className={styles.gameStatusRow} aria-label={text.soon}>
          <span>{text.soon}</span>
        </div>
      </div>
    </main>
  );
}
