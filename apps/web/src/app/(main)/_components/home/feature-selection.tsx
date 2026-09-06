"use client";

import {
  ArrowRight,
  ChatCircle,
  GameController,
  MapPin,
  RoadHorizon,
} from "@phosphor-icons/react";
import type { EventDto, PostDto } from "@iride/types";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { Locale } from "@/lib/locale";
import {
  selectLatestCommunityPosts,
  selectUpcomingEvents,
  type HomeFeatureKind,
  type HomeLoadState,
  type RecentJourneyKind,
} from "@/lib/home-domain";
import { PendingLink } from "../pending-link";
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
      detail: "ดูตัวอย่างเกมส์ที่กำลังพัฒนา ระบบเล่นและคะแนนจะตามมาภายหลัง",
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
    comingSoon: "COMING SOON",
    gamePreview: "ตัวอย่างเกมส์ ยังไม่มีการบันทึกคะแนนหรือข้อมูลการเล่น",
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
      detail: "Preview games in development. Gameplay and scores come later.",
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
    comingSoon: "COMING SOON",
    gamePreview: "Game preview only. No score or gameplay data is stored.",
  },
} as const;

const features = [
  { kind: "community", href: "/community/groups", number: "01" },
  { kind: "games", href: "/games", number: "02" },
  { kind: "activities", href: "/maps", number: "03" },
] as const;

export function FeatureSelection({
  events,
  locale,
  onNavigate,
  posts,
}: {
  readonly events: HomeLoadState<EventDto[]>;
  readonly locale: Locale;
  readonly onNavigate: (kind: RecentJourneyKind, href: string) => void;
  readonly posts: HomeLoadState<PostDto[]>;
}) {
  const text = copy[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [active, setActive] = useState<HomeFeatureKind | null>(null);
  const [pointerEnabled, setPointerEnabled] = useState(false);
  const communityPost =
    posts.status === "ready"
      ? selectLatestCommunityPosts(posts.data).groups
      : undefined;
  const upcomingEvent =
    events.status === "ready"
      ? selectUpcomingEvents(events.data)[0]
      : undefined;

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
              {...(kind === "games"
                ? {}
                : { onClick: () => onNavigate(kind, href) })}
              onBlur={(event) => {
                if (
                  !event.currentTarget.parentElement?.contains(
                    event.relatedTarget,
                  )
                )
                  setActive(null);
              }}
              onFocus={() => setActive(kind)}
              onPointerEnter={() => setActive(kind)}
              onPointerLeave={(event) => {
                if (document.activeElement !== event.currentTarget) {
                  setActive(null);
                }
                resetPointer(event.currentTarget);
              }}
              onPointerMove={movePointer}
            >
              {kind === "games" ? (
                <Image
                  alt=""
                  aria-hidden="true"
                  className={styles.featureImage}
                  fill
                  sizes="(max-width: 759px) 100vw, 50vw"
                  src="/home/game-road.png"
                />
              ) : null}
              <span className={styles.featureLight} aria-hidden="true" />
              <span className={styles.featureNumber}>{number}</span>
              <span className={styles.featureBody}>
                <span className={styles.featureLabel}>{item.label}</span>
                <strong>{item.title}</strong>
                <span className={styles.featureDetail}>{item.detail}</span>
              </span>
              <FeatureVisual
                communityPost={communityPost}
                events={events}
                kind={kind}
                locale={locale}
                posts={posts}
                upcomingEvent={upcomingEvent}
              />
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

function FeatureVisual({
  communityPost,
  events,
  kind,
  locale,
  posts,
  upcomingEvent,
}: {
  readonly communityPost: PostDto | undefined;
  readonly events: HomeLoadState<EventDto[]>;
  readonly kind: HomeFeatureKind;
  readonly locale: Locale;
  readonly posts: HomeLoadState<PostDto[]>;
  readonly upcomingEvent: EventDto | undefined;
}) {
  const text = copy[locale];
  if (kind === "community") {
    return (
      <span className={styles.communityVisual} aria-live="polite">
        {posts.status === "loading" ? (
          <span className={styles.featureDataState}>{text.loading}</span>
        ) : null}
        {posts.status === "error" ? (
          <span className={styles.featureDataState}>{text.loadError}</span>
        ) : null}
        {posts.status === "ready" && !communityPost ? (
          <span className={styles.featureDataState}>{text.communityEmpty}</span>
        ) : null}
        {communityPost ? (
          <span className={styles.featureSnapshot}>
            <small>@{communityPost.author.username}</small>
            <strong>{communityPost.body}</strong>
            <span>
              <ChatCircle aria-hidden size={16} /> {communityPost.commentCount}{" "}
              {text.comments}
            </span>
          </span>
        ) : null}
      </span>
    );
  }
  if (kind === "games") {
    return (
      <span className={styles.gameVisual} aria-hidden="true">
        <GameController size={24} weight="fill" />
        <span>
          <small>{text.comingSoon}</small>
          <strong>Traffic Endless Ride</strong>
          <span>{text.gamePreview}</span>
        </span>
        <RoadHorizon size={30} />
      </span>
    );
  }
  return (
    <span className={styles.activityVisual} aria-live="polite">
      {events.status === "loading" ? (
        <span className={styles.featureDataState}>{text.loading}</span>
      ) : null}
      {events.status === "error" ? (
        <span className={styles.featureDataState}>{text.loadError}</span>
      ) : null}
      {events.status === "ready" && !upcomingEvent ? (
        <span className={styles.featureDataState}>{text.activitiesEmpty}</span>
      ) : null}
      {upcomingEvent ? (
        <>
          <MapPin aria-hidden size={24} weight="fill" />
          <span>
            <small>{text.nextActivity}</small>
            <strong>{upcomingEvent.title}</strong>
            <span>
              {upcomingEvent.locationLabel}
              {upcomingEvent.destinationLabel
                ? ` → ${upcomingEvent.destinationLabel}`
                : ""}
            </span>
            <span>
              {text.organizedBy} {upcomingEvent.organizer.displayName}
            </span>
          </span>
          <span className={styles.routeDot} />
        </>
      ) : null}
    </span>
  );
}
