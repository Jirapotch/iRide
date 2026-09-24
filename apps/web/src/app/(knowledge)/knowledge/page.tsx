import { ArrowRight, Waveform, Wrench } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";

import { KnowledgeShell } from "@/features/knowledge/components/knowledge-shell";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { getRequestLocale } from "@/lib/request-locale";

import styles from "@/features/knowledge/components/knowledge.module.css";

const copy = {
  th: {
    eyebrow: "iRide Knowledge Lab",
    title: "สื่อความรู้",
    intro:
      "เรียนรู้สิ่งที่ทำให้ทุกการเดินทางเคลื่อนไหว ผ่านการทดลองที่จับต้องได้",
    available: "ทดลองได้แล้ว",
    body: "เปิดดูชิ้นส่วนเครื่องยนต์ในภาพ 3D บิดกุญแจสตาร์ท ฟังเสียงตามรอบจริง และสำรวจจังหวะการจุดระเบิดของเครื่องยนต์ 35 แบบ",
    launch: "เปิด Engine Simulator 3D",
    mechanics: "กลไก 3D",
    sound: "เสียงตามรอบเครื่อง",
    engines: "เครื่องยนต์ 35 แบบ",
    note: "ทำงานในเบราว์เซอร์โดยไม่เรียก API",
  },
  en: {
    eyebrow: "iRide Knowledge Lab",
    title: "Knowledge",
    intro:
      "Explore the mechanics behind every journey through hands-on experiments.",
    available: "Ready to explore",
    body: "See an engine cutaway in 3D, turn the key, hear its changing RPM, and explore the firing cycles of 35 engines.",
    launch: "Open Engine Simulator 3D",
    mechanics: "3D mechanics",
    sound: "RPM-driven sound",
    engines: "35 engine profiles",
    note: "Runs in your browser without API calls",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: `${copy[locale].title} | iRide`,
    description: copy[locale].intro,
  };
}

export default async function KnowledgePage() {
  const locale = await getRequestLocale();
  const text = copy[locale];
  return (
    <KnowledgeShell locale={locale}>
      <div className={styles.page}>
        <section
          aria-labelledby="knowledge-title"
          className={styles.landingIntro}
        >
          <p className={styles.eyebrow}>{text.eyebrow}</p>
          <h1 data-route-heading id="knowledge-title" tabIndex={-1}>
            {text.title}
          </h1>
          <p>{text.intro}</p>
        </section>
        <section
          aria-label="Engine Simulator 3D"
          className={styles.knowledgeFeature}
        >
          <div className={styles.featureArt}>
            <Image
              alt={
                locale === "th"
                  ? "ภาพตัดเครื่องยนต์แสดงลูกสูบและเพลาข้อเหวี่ยง"
                  : "Engine cutaway showing pistons and crankshaft"
              }
              fill
              priority
              sizes="(max-width: 760px) 100vw, 60vw"
              src="/home/engine-cutaway.svg"
            />
          </div>
          <div className={styles.featureCopy}>
            <span className={styles.available}>
              <span /> {text.available}
            </span>
            <h2>Engine Simulator 3D</h2>
            <p>{text.body}</p>
            <div className={styles.featureFacts}>
              <span>
                <Wrench aria-hidden size={18} /> {text.mechanics}
              </span>
              <span>
                <Waveform aria-hidden size={18} /> {text.sound}
              </span>
              <span>{text.engines}</span>
            </div>
            <PendingLink
              className={styles.launchLink}
              href="/knowledge/engine-simulator"
              prefetch={false}
            >
              {text.launch} <ArrowRight aria-hidden size={19} />
            </PendingLink>
            <small>{text.note}</small>
          </div>
        </section>
      </div>
    </KnowledgeShell>
  );
}
