"use client";

import {
  ArrowRight,
  Bicycle,
  Car,
  ChatCircle,
  Compass,
  MapPin,
  Motorcycle,
  Play,
  UsersThree,
} from "@phosphor-icons/react";
import type { EventDto, OwnProfileDto, PostDto } from "@iride/types";
import Image from "next/image";
import { useEffect, useMemo, useReducer, useState } from "react";

import {
  filterTrendingPosts,
  parseRecentJourneys,
  readHomeStorage,
  recordRecentJourney,
  selectLatestCommunityPosts,
  selectUpcomingEvents,
  writeHomeStorage,
  type HomeLoadState,
  type RecentJourneyItem,
  type RecentJourneyKind,
  type TrendingFilter,
} from "@/lib/home-domain";
import type { Locale } from "@/lib/locale";
import { BrowserApiError, browserApiGet } from "@/services/browser-api";
import { PendingLink } from "../pending-link";
import { FeatureSelection } from "./feature-selection";
import { HomeMiniMap } from "./home-mini-map";
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
    preview: "ตัวอย่าง",
    gameBody:
      "ถนนไม่มีที่สิ้นสุด จังหวะที่ต้องตัดสินใจ และการเดินทางครั้งใหม่ที่กำลังมา",
    gameAction: "ดูเกมส์",
    groupsKicker: "COMMUNITY",
    groupsTitle: "เลือกชุมชนตามประเภทรถ",
    groupsError: "ไม่สามารถโหลดโพสต์ของแต่ละชุมชนได้",
    groupsEmpty: "ยังไม่มีโพสต์ในชุมชนนี้",
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
    preview: "Preview",
    gameBody:
      "An endless road, quick decisions, and a new kind of journey coming soon.",
    gameAction: "View games",
    groupsKicker: "COMMUNITY",
    groupsTitle: "Explore by vehicle",
    groupsError: "Vehicle community posts could not load",
    groupsEmpty: "There are no posts in this community yet.",
    viewCommunity: "View community",
    exploreTitle: "Your next story starts by looking around",
    exploreBody:
      "Discover the people, places, and activities happening around you.",
    exploreAction: "Open the map",
    footer:
      "Made for everyone who believes the road means more than the destination.",
  },
} as const;

const filterOrder = ["all", "car", "motorcycle", "bicycle"] as const;

const communityDestinations = [
  { kind: "car", href: "/community/car/talk", icon: Car },
  {
    kind: "motorcycle",
    href: "/community/motorcycle/talk",
    icon: Motorcycle,
  },
  { kind: "bicycle", href: "/community/bicycle/talk", icon: Bicycle },
] as const;

function recentJourneyReducer(
  _state: RecentJourneyItem[],
  items: RecentJourneyItem[],
): RecentJourneyItem[] {
  return items;
}

export function HomeDiscovery({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  const [posts, setPosts] = useState<HomeLoadState<PostDto[]>>({
    status: "loading",
  });
  const [events, setEvents] = useState<HomeLoadState<EventDto[]>>({
    status: "loading",
  });
  const [profile, setProfile] = useState<HomeLoadState<OwnProfileDto | null>>({
    status: "loading",
  });
  const [recent, setRecent] = useReducer(recentJourneyReducer, []);
  const [filter, setFilter] = useState<TrendingFilter>("all");
  const [postsReload, setPostsReload] = useState(0);
  const [eventsReload, setEventsReload] = useState(0);

  useEffect(() => {
    setRecent(
      parseRecentJourneys(
        readHomeStorage(() => window.localStorage, RECENT_KEY),
      ),
    );
  }, []);

  useEffect(() => {
    let active = true;
    void browserApiGet<PostDto[]>("/posts")
      .then((data) => active && setPosts({ status: "ready", data }))
      .catch(() => active && setPosts({ status: "error" }));
    return () => {
      active = false;
    };
  }, [postsReload]);

  useEffect(() => {
    let active = true;
    void browserApiGet<EventDto[]>("/events")
      .then((data) => active && setEvents({ status: "ready", data }))
      .catch(() => active && setEvents({ status: "error" }));
    return () => {
      active = false;
    };
  }, [eventsReload]);

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

  function retryPosts() {
    setPosts({ status: "loading" });
    setPostsReload((value) => value + 1);
  }

  function retryEvents() {
    setEvents({ status: "loading" });
    setEventsReload((value) => value + 1);
  }

  return (
    <main className={styles.home}>
      <Hero locale={locale} profile={profile} />
      <FeatureSelection
        events={events}
        locale={locale}
        onNavigate={remember}
        posts={posts}
      />
      {recent.length ? (
        <ContinueJourney locale={locale} recent={recent} />
      ) : null}
      <TrendingCommunity
        filter={filter}
        locale={locale}
        onFilter={setFilter}
        onRetry={retryPosts}
        posts={posts}
      />
      <UpcomingActivities
        events={events}
        locale={locale}
        onRetry={retryEvents}
      />
      <GameSpotlight locale={locale} />
      <CommunityCategories locale={locale} onRetry={retryPosts} posts={posts} />
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

function ContinueJourney({
  locale,
  recent,
}: {
  readonly locale: Locale;
  readonly recent: readonly RecentJourneyItem[];
}) {
  const text = copy[locale];
  const itemLabels = {
    th: {
      community: ["ชุมชน", "กลับไปดูบทสนทนา"],
      activities: ["กิจกรรม", "กลับไปสำรวจแผนที่"],
    },
    en: {
      community: ["Community", "Return to the conversation"],
      activities: ["Activities", "Return to the map"],
    },
  } as const;
  const icons = { community: UsersThree, activities: MapPin };
  return (
    <section
      className={styles.continueSection}
      aria-labelledby="continue-title"
    >
      <SectionHeading
        kicker={text.continueKicker}
        title={text.continueTitle}
        id="continue-title"
      />
      <div className={styles.continueRail}>
        {recent.map((item) => {
          const Icon = icons[item.kind];
          const [title, detail] = itemLabels[locale][item.kind];
          return (
            <PendingLink href={item.href} key={item.kind}>
              <Icon aria-hidden size={24} weight="duotone" />
              <span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <ArrowRight aria-hidden size={17} />
            </PendingLink>
          );
        })}
      </div>
    </section>
  );
}

function TrendingCommunity({
  filter,
  locale,
  onFilter,
  onRetry,
  posts,
}: {
  readonly filter: TrendingFilter;
  readonly locale: Locale;
  readonly onFilter: (filter: TrendingFilter) => void;
  readonly onRetry: () => void;
  readonly posts: HomeLoadState<PostDto[]>;
}) {
  const text = copy[locale];
  const items = useMemo(
    () =>
      posts.status === "ready" ? filterTrendingPosts(posts.data, filter) : [],
    [filter, posts],
  );
  return (
    <section
      className={styles.trendingSection}
      aria-labelledby="trending-title"
    >
      <div className={styles.sectionTopline}>
        <SectionHeading
          kicker={text.trendingKicker}
          title={text.trendingTitle}
          id="trending-title"
        />
        <div
          className={styles.filters}
          role="group"
          aria-label={text.trendingTitle}
        >
          {filterOrder.map((value) => (
            <button
              aria-pressed={filter === value}
              key={value}
              onClick={() => onFilter(value)}
              type="button"
            >
              {text[value]}
            </button>
          ))}
        </div>
      </div>
      {posts.status === "loading" ? (
        <SectionSkeleton locale={locale} variant="posts" />
      ) : null}
      {posts.status === "error" ? (
        <InlineError
          message={text.trendingError}
          onRetry={onRetry}
          retry={text.retry}
        />
      ) : null}
      {posts.status === "ready" && !items.length ? (
        <p className={styles.emptyState}>{text.trendingEmpty}</p>
      ) : null}
      {items.length ? (
        <div className={styles.editorialPosts} aria-live="polite">
          <PostStory featured locale={locale} post={items[0]!} />
          <div className={styles.postStack}>
            {items.slice(1, 4).map((post) => (
              <PostStory key={post.id} locale={locale} post={post} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PostStory({
  featured = false,
  locale,
  post,
}: {
  readonly featured?: boolean;
  readonly locale: Locale;
  readonly post: PostDto;
}) {
  const text = copy[locale];
  return (
    <PendingLink
      className={`${styles.postStory} ${featured ? styles.featuredPost : ""}`}
      href={postHref(post)}
    >
      <span className={styles.postMeta}>
        {post.communityCategory} · @{post.author.username}
      </span>
      <strong>{post.body}</strong>
      <span className={styles.postFooter}>
        <span>{post.author.displayName}</span>
        <span>
          <ChatCircle aria-hidden size={16} /> {post.commentCount}{" "}
          {text.comments}
        </span>
      </span>
    </PendingLink>
  );
}

function UpcomingActivities({
  events,
  locale,
  onRetry,
}: {
  readonly events: HomeLoadState<EventDto[]>;
  readonly locale: Locale;
  readonly onRetry: () => void;
}) {
  const text = copy[locale];
  const items =
    events.status === "ready"
      ? selectUpcomingEvents(events.data).slice(0, 3)
      : [];
  const featured = items[0];
  return (
    <section
      className={styles.activitiesSection}
      aria-labelledby="activities-title"
    >
      <SectionHeading
        kicker={text.activitiesKicker}
        title={text.activitiesTitle}
        id="activities-title"
      />
      {events.status === "loading" ? (
        <SectionSkeleton locale={locale} variant="activity" />
      ) : null}
      {events.status === "error" ? (
        <InlineError
          message={text.activitiesError}
          onRetry={onRetry}
          retry={text.retry}
        />
      ) : null}
      {events.status === "ready" && !featured ? (
        <p className={styles.emptyState}>{text.activitiesEmpty}</p>
      ) : null}
      {featured ? (
        <div className={styles.activityFeature}>
          <div className={styles.activityCopy}>
            <span className={styles.dateTile}>
              <strong>
                {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", {
                  day: "2-digit",
                }).format(new Date(featured.startsAt))}
              </strong>
              <small>
                {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", {
                  month: "short",
                }).format(new Date(featured.startsAt))}
              </small>
            </span>
            <p>{featured.kind.toUpperCase()}</p>
            <h3>{featured.title}</h3>
            <span className={styles.routeLabel}>
              <MapPin aria-hidden size={18} weight="fill" />
              {featured.locationLabel}
              {featured.destinationLabel
                ? ` → ${featured.destinationLabel}`
                : ""}
            </span>
            <PendingLink
              href={`/maps?marker=${encodeURIComponent(featured.id)}`}
            >
              {text.seeTrip} <ArrowRight aria-hidden size={18} />
            </PendingLink>
          </div>
          <HomeMiniMap event={featured} locale={locale} />
        </div>
      ) : null}
    </section>
  );
}

function GameSpotlight({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  return (
    <section className={styles.gameSpotlight} aria-labelledby="game-title">
      <Image
        alt={
          locale === "th"
            ? "รถยนต์สีเข้มกำลังแล่นบนถนนกลางป่ายามพลบค่ำ"
            : "A dark vehicle following an open forest road at dusk"
        }
        className={styles.gameImage}
        fill
        sizes="100vw"
        src="/home/game-road.png"
      />
      <span className={styles.gameVeil} aria-hidden="true" />
      <div className={styles.gameContent}>
        <p>{text.gameKicker}</p>
        <span className={styles.previewBadge}>{text.preview}</span>
        <h2 id="game-title">
          TRAFFIC
          <br />
          ENDLESS RIDE
        </h2>
        <strong>{text.gameTitle}</strong>
        <span>{text.gameBody}</span>
        <PendingLink href="/games">
          <Play aria-hidden size={18} weight="fill" /> {text.gameAction}
        </PendingLink>
      </div>
    </section>
  );
}

function CommunityCategories({
  locale,
  onRetry,
  posts,
}: {
  readonly locale: Locale;
  readonly onRetry: () => void;
  readonly posts: HomeLoadState<PostDto[]>;
}) {
  const text = copy[locale];
  const latestPosts =
    posts.status === "ready" ? selectLatestCommunityPosts(posts.data) : {};
  return (
    <section
      className={styles.groupsSection}
      aria-labelledby="groups-title"
      data-ui="community-categories"
    >
      <SectionHeading
        kicker={text.groupsKicker}
        title={text.groupsTitle}
        id="groups-title"
      />
      {posts.status === "loading" ? (
        <SectionSkeleton locale={locale} variant="posts" />
      ) : null}
      {posts.status === "error" ? (
        <InlineError
          message={text.groupsError}
          onRetry={onRetry}
          retry={text.retry}
        />
      ) : null}
      {posts.status === "ready" ? (
        <div className={styles.groupRail} aria-live="polite">
          {communityDestinations.map(({ kind, href, icon: Icon }) => {
            const post = latestPosts[kind];
            const label = text[kind];
            const linkLabel =
              locale === "th"
                ? `${text.viewCommunity} ${label}`
                : `View ${label} community`;
            return (
              <article className={styles.groupCard} key={kind}>
                <span className={styles.groupIcon}>
                  <Icon aria-hidden size={24} weight="duotone" />
                </span>
                <small>{kind}</small>
                <h3>{label}</h3>
                {post ? (
                  <>
                    <p>{post.body}</p>
                    <span className={styles.groupMeta}>
                      <span>@{post.author.username}</span>
                      <span>
                        <ChatCircle aria-hidden size={15} /> {post.commentCount}
                      </span>
                    </span>
                  </>
                ) : (
                  <p className={styles.groupEmpty}>{text.groupsEmpty}</p>
                )}
                <PendingLink aria-label={linkLabel} href={href}>
                  {linkLabel} <ArrowRight aria-hidden size={17} />
                </PendingLink>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function SectionHeading({
  id,
  kicker,
  title,
}: {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <p>{kicker}</p>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

function SectionSkeleton({
  locale,
  variant,
}: {
  readonly locale: Locale;
  readonly variant: "posts" | "activity";
}) {
  return (
    <div
      aria-busy="true"
      aria-label={locale === "th" ? "กำลังโหลด" : "Loading"}
      className={`${styles.sectionSkeleton} ${styles[variant]}`}
      role="status"
    >
      <span />
      <span />
      <span />
    </div>
  );
}

function InlineError({
  message,
  onRetry,
  retry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
  readonly retry: string;
}) {
  return (
    <div className={styles.inlineError} role="alert">
      <strong>{message}</strong>
      <button onClick={onRetry} type="button">
        {retry}
      </button>
    </div>
  );
}

function postHref(post: PostDto): string {
  const path =
    post.communityCategory === "groups"
      ? "/community/groups"
      : `/community/${post.communityCategory}/talk`;
  return `${path}?post=${encodeURIComponent(post.id)}`;
}
