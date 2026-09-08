"use client";

import { ArrowRight, Compass } from "@phosphor-icons/react";
import type { OwnProfileDto } from "@iride/types";
import Image from "next/image";
import { useEffect, useReducer, useState } from "react";

import {
  parseRecentJourneys,
  readHomeStorage,
  recordRecentJourney,
  writeHomeStorage,
  type HomeLoadState,
  type RecentJourneyItem,
  type RecentJourneyKind,
} from "@/lib/home-domain";
import type { Locale } from "@/lib/locale";
import { BrowserApiError, browserApiGet } from "@/services/browser-api";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { FeatureSelection } from "./feature-selection";
import styles from "./home.module.css";

const RECENT_KEY = "iride.home.recent.v1";

const copy = {
  th: {
    heroKicker: "COMMUNITY • GAMES • ACTIVITIES",
    heroTitle: "ทุกเส้นทาง มีเรื่องราว",
    heroBody: "พบผู้คน เล่นสนุก และออกไปสร้างความทรงจำบนเส้นทางเดียวกัน",
    hello: "สวัสดี",
    helloGuest: "ยินดีต้อนรับสู่ iRide",
    ready: "พร้อมออกไปสนุกกันหรือยัง?",
    continueKicker: "CONTINUE",
    continueTitle: "ไปต่อจากที่ค้างไว้",
    trendingKicker: "TRENDING",
    trendingTitle: "กำลังพูดถึง",
    trendingError: "ไม่สามารถโหลดเรื่องราวจากชุมชนได้",
    trendingEmpty: "ยังไม่มีเรื่องราวในหมวดนี้",
    retry: "ลองอีกครั้ง",
    all: "ทั้งหมด",
    car: "รถยนต์",
    motorcycle: "มอเตอร์ไซค์",
    bicycle: "จักรยาน",
    comments: "ความคิดเห็น",
    activitiesKicker: "ACTIVITIES",
    activitiesTitle: "ออกไปเจอกัน",
    activitiesError: "ไม่สามารถโหลดกิจกรรมได้ในขณะนี้",
    activitiesEmpty: "ยังไม่มีกิจกรรมที่กำลังจะมาถึง",
    seeTrip: "ดูทริป",
    gameKicker: "GAME SPOTLIGHT",
    gameTitle: "เล่นอะไรดี?",
    preview: "เล่นได้แล้ว",
    gameBody:
      "เลือกพาหนะ หลบการจราจร และทำคะแนนบนถนนที่ไม่มีที่สิ้นสุดได้แล้ววันนี้",
    gameAction: "ดูเกมส์",
    groupsKicker: "COMMUNITY",
    groupsTitle: "เลือกชุมชนตามประเภทรถ",
    viewCommunity: "ดูชุมชน",
    exploreTitle: "เรื่องราวต่อไป เริ่มจากการออกไปค้นหา",
    exploreBody: "ดูผู้คน สถานที่ และกิจกรรมที่กำลังเกิดขึ้นรอบตัวคุณ",
    exploreAction: "เปิดแผนที่",
    footer: "สร้างขึ้นเพื่อทุกคนที่เชื่อว่าเส้นทางมีความหมายมากกว่าจุดหมาย",
  },
  en: {
    heroKicker: "COMMUNITY • GAMES • ACTIVITIES",
    heroTitle: "Every road has a story",
    heroBody: "Meet people, play, and create new memories along the same road.",
    hello: "Hello",
    helloGuest: "Welcome to iRide",
    ready: "Ready to enjoy the road?",
    continueKicker: "CONTINUE",
    continueTitle: "Continue your journey",
    trendingKicker: "TRENDING",
    trendingTitle: "What people are talking about",
    trendingError: "Community stories could not load",
    trendingEmpty: "There are no stories in this category yet.",
    retry: "Retry",
    all: "All",
    car: "Cars",
    motorcycle: "Motorcycles",
    bicycle: "Bicycles",
    comments: "comments",
    activitiesKicker: "ACTIVITIES",
    activitiesTitle: "Meet out there",
    activitiesError: "Activities could not load right now",
    activitiesEmpty: "There are no upcoming activities yet.",
    seeTrip: "View trip",
    gameKicker: "GAME SPOTLIGHT",
    gameTitle: "What should we play?",
    preview: "Playable now",
    gameBody:
      "Choose a ride, weave through traffic, and score your endless run today.",
    gameAction: "View games",
    groupsKicker: "COMMUNITY",
    groupsTitle: "Explore by vehicle",
    viewCommunity: "View community",
    exploreTitle: "Your next story starts by looking around",
    exploreBody:
      "Discover the people, places, and activities happening around you.",
    exploreAction: "Open the map",
    footer:
      "Made for everyone who believes the road means more than the destination.",
  },
} as const;

function recentJourneyReducer(
  _state: RecentJourneyItem[],
  items: RecentJourneyItem[],
): RecentJourneyItem[] {
  return items;
}

export function HomeDiscovery({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  const [profile, setProfile] = useState<HomeLoadState<OwnProfileDto | null>>({
    status: "loading",
  });
  const [recent, setRecent] = useReducer(recentJourneyReducer, []);

  useEffect(() => {
    setRecent(
      parseRecentJourneys(
        readHomeStorage(() => window.localStorage, RECENT_KEY),
      ),
    );
  }, []);

  useEffect(() => {
    let active = true;
    void browserApiGet<OwnProfileDto>("/profile/me")
      .then((data) => active && setProfile({ status: "ready", data }))
      .catch((error: unknown) => {
        if (!active) return;
        if (
          error instanceof BrowserApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          setProfile({ status: "ready", data: null });
        } else {
          setProfile({ status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function remember(kind: RecentJourneyKind, href: string) {
    const next = recordRecentJourney(recent, {
      kind,
      href,
      visitedAt: new Date().toISOString(),
    });
    setRecent(next);
    writeHomeStorage(
      () => window.localStorage,
      RECENT_KEY,
      JSON.stringify(next),
    );
  }

  return (
    <main className={styles.home}>
      <Hero locale={locale} profile={profile} />
      <FeatureSelection locale={locale} onNavigate={remember} />
      <section className={styles.exploreCta}>
        <Compass aria-hidden size={36} weight="duotone" />
        <div>
          <h2>{text.exploreTitle}</h2>
          <p>{text.exploreBody}</p>
        </div>
        <PendingLink
          href="/maps"
          onClick={() => remember("activities", "/maps")}
        >
          {text.exploreAction} <ArrowRight aria-hidden size={18} />
        </PendingLink>
      </section>
      <footer className={styles.homeFooter}>
        <strong>iRide</strong>
        <p>{text.footer}</p>
      </footer>
    </main>
  );
}

function Hero({
  locale,
  profile,
}: {
  readonly locale: Locale;
  readonly profile: HomeLoadState<OwnProfileDto | null>;
}) {
  const text = copy[locale];
  const name =
    profile.status === "ready" ? profile.data?.displayName?.trim() : null;
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <Image
        alt={
          locale === "th"
            ? "รถยนต์ มอเตอร์ไซค์ และจักรยานร่วมเส้นทางภูเขายามพระอาทิตย์ขึ้น"
            : "A car, motorcycle, and bicycles sharing a mountain road at sunrise"
        }
        className={styles.heroImage}
        fill
        priority
        sizes="100vw"
        src="/home/hero-journey.png"
      />
      <span className={styles.heroVeil} aria-hidden="true" />
      <div className={styles.heroContent}>
        <p className={styles.heroKicker}>{text.heroKicker}</p>
        <h1 data-route-heading id="home-title" tabIndex={-1}>
          {text.heroTitle}
        </h1>
        <p className={styles.heroBody}>{text.heroBody}</p>
        <div className={styles.welcomePanel}>
          <span>{name ? `${text.hello}, ${name}` : text.helloGuest}</span>
          <strong>{text.ready}</strong>
        </div>
      </div>
    </section>
  );
}
