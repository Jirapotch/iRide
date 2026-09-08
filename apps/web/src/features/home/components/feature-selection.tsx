"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { shouldExpandFeatureForFocus } from "@/features/home/feature-interaction";
import type { Locale } from "@/lib/locale";
import {
  type HomeFeatureKind,
  type RecentJourneyKind,
} from "@/lib/home-domain";
import { PendingLink } from "@/features/navigation/components/pending-link";
import styles from "./home.module.css";

const copy = {
  th: {
    kicker: "EXPLORE",
    heading: "เลือกพื้นที่ของคุณ",
    community: {
      label: "Community",
      title: "ชุมชน",
      detail: "พูดคุย แชร์เรื่องราว และพบคนที่สนใจเหมือนกัน",
      action: "สำรวจชุมชน",
    },
    games: {
      label: "Games",
      title: "เกมส์",
      detail:
        "เลือกพาหนะแล้วท้าทายถนนที่ไม่มีวันสิ้นสุด เล่นได้ทั้งคีย์บอร์ดและมือถือ",
      action: "ดูเกมส์",
    },
    activities: {
      label: "Activities",
      title: "กิจกรรม",
      detail: "นัดพบ ออกทริป และสร้างประสบการณ์ร่วมกัน",
      action: "ดูกิจกรรม",
    },
    loading: "กำลังโหลดข้อมูลล่าสุด",
    loadError: "โหลดข้อมูลล่าสุดไม่ได้",
    communityEmpty: "ยังไม่มีโพสต์ในชุมชนรวม",
    activitiesEmpty: "ยังไม่มีกิจกรรมที่กำลังจะมาถึง",
    comments: "ความคิดเห็น",
    organizedBy: "จัดโดย",
    nextActivity: "กิจกรรมถัดไป",
    comingSoon: "PLAY NOW",
    gamePreview: "เล่นได้แล้ว • ไม่มีการบันทึกคะแนนหรือข้อมูลการเล่น",
  },
  en: {
    kicker: "EXPLORE",
    heading: "Choose your space",
    community: {
      label: "Community",
      title: "Community",
      detail: "Talk, share stories, and meet people who move like you.",
      action: "Explore community",
    },
    games: {
      label: "Games",
      title: "Games",
      detail:
        "Choose a ride and challenge the endless road on keyboard or mobile.",
      action: "View games",
    },
    activities: {
      label: "Activities",
      title: "Activities",
      detail: "Meet, travel, and create real-world stories together.",
      action: "View activities",
    },
    loading: "Loading the latest data",
    loadError: "The latest data could not load",
    communityEmpty: "There are no group posts yet",
    activitiesEmpty: "There are no upcoming activities yet",
    comments: "comments",
    organizedBy: "Organized by",
    nextActivity: "NEXT ACTIVITY",
    comingSoon: "PLAY NOW",
    gamePreview: "Playable now • No score or gameplay data is stored",
  },
} as const;

const features = [
  { kind: "community", href: "/community", number: "01" },
  { kind: "games", href: "/games", number: "02" },
  { kind: "activities", href: "/maps", number: "03" },
] as const;

export function FeatureSelection({
  locale,
  onNavigate,
}: {
  readonly locale: Locale;
  readonly onNavigate: (kind: RecentJourneyKind, href: string) => void;
}) {
  const text = copy[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [active, setActive] = useState<HomeFeatureKind | null>(null);
  const [pointerEnabled, setPointerEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const sync = () => setPointerEnabled(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let cancelled = false;
    let cleanup: () => void = () => {};
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        void import("gsap").then(({ gsap }) => {
          if (cancelled || !root.isConnected) return;
          const context = gsap.context(() => {
            gsap.fromTo(
              root.querySelectorAll("[data-feature-card]"),
              { autoAlpha: 0, y: 30, scale: 0.97 },
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.45,
                stagger: 0.1,
                ease: "power2.out",
                clearProps: "transform,opacity,visibility",
              },
            );
          }, root);
          cleanup = () => context.revert();
        });
      },
      { threshold: 0.18 },
    );
    observer.observe(root);
    return () => {
      cancelled = true;
      observer.disconnect();
      cleanup();
    };
  }, []);

  function movePointer(event: PointerEvent<HTMLAnchorElement>) {
    if (!pointerEnabled) return;
    const card = event.currentTarget;
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - left) / width));
    const y = Math.min(1, Math.max(0, (event.clientY - top) / height));
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      card.style.setProperty("--mouse-x", `${x * 100}%`);
      card.style.setProperty("--mouse-y", `${y * 100}%`);
      card.style.setProperty("--shift-x", `${(x - 0.5) * 8}px`);
      card.style.setProperty("--shift-y", `${(y - 0.5) * 6}px`);
    });
  }

  function resetPointer(card: HTMLAnchorElement) {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    card.style.setProperty("--mouse-x", "50%");
    card.style.setProperty("--mouse-y", "50%");
    card.style.setProperty("--shift-x", "0px");
    card.style.setProperty("--shift-y", "0px");
  }

  return (
    <section className={styles.exploreSection} aria-labelledby="explore-title">
      <div className={styles.sectionHeading}>
        <p>{text.kicker}</p>
        <h2 id="explore-title">{text.heading}</h2>
      </div>
      <div
        className={styles.featureGrid}
        data-active={active ?? "none"}
        data-pointer-enabled={pointerEnabled ? "true" : "false"}
        data-ui="feature-selection"
        ref={rootRef}
      >
        {features.map(({ kind, href, number }) => {
          const item = text[kind];
          return (
            <PendingLink
              aria-label={item.label}
              className={`${styles.featureCard} ${styles[kind]}`}
              data-feature-card={kind}
              href={href}
              key={kind}
              onClick={() => onNavigate(kind, href)}
              onBlur={(event) => {
                if (
                  !event.currentTarget.parentElement?.contains(
                    event.relatedTarget,
                  )
                )
                  setActive(null);
              }}
              onFocus={(event) => {
                if (
                  shouldExpandFeatureForFocus(
                    event.currentTarget.matches(":focus-visible"),
                  )
                ) {
                  setActive(kind);
                }
              }}
              onPointerEnter={() => setActive(kind)}
              onPointerLeave={(event) => {
                if (!event.currentTarget.matches(":focus-visible")) {
                  setActive(null);
                }
                resetPointer(event.currentTarget);
              }}
              onPointerMove={movePointer}
            >
              <span className={styles.featureLight} aria-hidden="true" />
              <span className={styles.featureNumber}>{number}</span>
              <span className={styles.featureBody}>
                <span className={styles.featureLabel}>{item.label}</span>
                <strong>{item.title}</strong>
                <span className={styles.featureDetail}>{item.detail}</span>
              </span>
              <span className={styles.featureAction}>
                {item.action} <ArrowRight aria-hidden size={18} />
              </span>
            </PendingLink>
          );
        })}
      </div>
    </section>
  );
}
