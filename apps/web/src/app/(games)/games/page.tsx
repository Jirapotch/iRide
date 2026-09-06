import {
  ArrowLeftIcon,
  ArrowRight,
  GameController,
  Play,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BrandMark } from "@/app/_components/brand-mark";
import { getRequestLocale } from "@/lib/request-locale";

import { RouteHeading } from "./_components/route-heading";
import styles from "./games.module.css";

const copy = {
  th: {
    back: "กลับหน้าหลัก",
    kicker: "iRide Arcade",
    title: "เกมส์",
    intro: "เลือกพาหนะ หลบการจราจร และไปให้ไกลที่สุดบนถนนที่ไม่มีวันสิ้นสุด",
    playable: "เล่นได้แล้ว",
    gameBody:
      "Endless runner จังหวะเร็วที่ให้คุณเลือก Sedan, Sport, Moto หรือจักรยาน แล้วฝ่าการจราจรที่หนาแน่นขึ้นเรื่อย ๆ",
    controls: "คีย์บอร์ด · เมาส์ · สัมผัส",
    noSave: "ไม่บันทึกคะแนนหรือข้อมูลการเล่น",
    play: "เลือก Traffic Endless Ride",
  },
  en: {
    back: "Back home",
    kicker: "iRide Arcade",
    title: "Games",
    intro: "Choose a ride, weave through traffic, and chase the endless road.",
    playable: "Playable now",
    gameBody:
      "A fast endless runner where Sedan, Sport, Moto, and Bicycle face traffic that gets denser with every stage.",
    controls: "Keyboard · mouse · touch",
    noSave: "No score or gameplay data is saved",
    play: "Choose Traffic Endless Ride",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: locale === "th" ? "เกมส์ | iRide" : "Games | iRide",
    description: copy[locale].intro,
  };
}

export default async function GamesPage() {
  const locale = await getRequestLocale();
  const text = copy[locale];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          aria-label="iRide home"
          className={styles.brand}
          href="/"
        >
          <BrandMark />
        </Link>
        <Link className={styles.back} href="/">
          <ArrowLeftIcon aria-hidden size={18} /> {text.back}
        </Link>
      </header>

      <section className={styles.intro} aria-labelledby="games-title">
        <div>
          <p>{text.kicker}</p>
          <RouteHeading>{text.title}</RouteHeading>
        </div>
        <p>{text.intro}</p>
      </section>

      <section className={styles.catalog} aria-label={text.title}>
        <Link
          aria-label={`${text.play}: Traffic Endless Ride`}
          className={styles.gameCard}
          href="/games/traffic-endless-ride"
          prefetch={false}
        >
          <div className={styles.artwork}>
            <Image
              alt=""
              aria-hidden="true"
              fill
              priority
              sizes="(max-width: 700px) 100vw, 62vw"
              src="/home/game-road.png"
            />
            <span className={styles.artworkVeil} />
            <span className={styles.playIcon}>
              <Play aria-hidden size={28} weight="fill" />
            </span>
          </div>
          <div className={styles.gameCopy}>
            <span className={styles.status}>
              <i /> {text.playable}
            </span>
            <p className={styles.eyebrow}>ENDLESS RUNNER</p>
            <h2>Traffic Endless Ride</h2>
            <p>{text.gameBody}</p>
            <div className={styles.meta}>
              <span>
                <GameController aria-hidden size={18} /> {text.controls}
              </span>
              <span>{text.noSave}</span>
            </div>
            <strong>
              {text.play} <ArrowRight aria-hidden size={19} />
            </strong>
          </div>
        </Link>
      </section>
    </main>
  );
}
