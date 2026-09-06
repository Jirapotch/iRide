"use client";

import {
  ArrowRight,
  Bicycle,
  Car,
  ChatCircle,
  Check,
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
  selectUpcomingEvents,
  writeHomeStorage,
  type DemoGroup,
  type HomeFeatureKind,
  type HomeLoadState,
  type RecentJourneyItem,
  type TrendingFilter,
} from "@/lib/home-domain";
import type { Locale } from "@/lib/locale";
import { BrowserApiError, browserApiGet } from "@/services/browser-api";
import { PendingLink } from "../pending-link";
import { FeatureSelection } from "./feature-selection";
import { HomeMiniMap } from "./home-mini-map";
import styles from "./home.module.css";

const RECENT_KEY = "iride.home.recent.v1";
const GROUPS_KEY = "iride.home.demo-groups.v1";

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
    groupsKicker: "GROUPS",
    groupsTitle: "เจอคนที่ชอบเหมือนกัน",
    demo: "ข้อมูลตัวอย่าง",
    join: "เข้าร่วม",
    joined: "เข้าร่วมแล้ว",
    groupsNote: "สถานะนี้เก็บเฉพาะในเบราว์เซอร์ ยังไม่เชื่อมต่อระบบสมาชิก",
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
    groupsKicker: "GROUPS",
    groupsTitle: "Find people who move like you",
    demo: "Demo content",
    join: "Join",
    joined: "Joined",
    groupsNote:
      "This state stays in your browser and is not connected to membership yet.",
    exploreTitle: "Your next story starts by looking around",
    exploreBody:
      "Discover the people, places, and activities happening around you.",
    exploreAction: "Open the map",
    footer:
      "Made for everyone who believes the road means more than the destination.",
  },
} as const;

const demoGroups: readonly DemoGroup[] = [
  {
    id: "weekend-roads",
    name: "Weekend Roads",
    category: "car",
    description: {
      th: "เส้นทางยามเช้า จุดแวะกาแฟ และการขับรถแบบไม่เร่งรีบ",
      en: "Morning routes, coffee stops, and unhurried drives.",
    },
    imageSrc: "/home/hero-journey.png",
  },
  {
    id: "two-wheel-stories",
    name: "Two Wheel Stories",
    category: "motorcycle",
    description: {
      th: "บันทึกการเดินทางและผู้คนที่พบระหว่างจุดหมาย",
      en: "Touring notes and the people met between destinations.",
    },
    imageSrc: "/home/game-road.png",
  },
  {
    id: "city-pedals",
    name: "City Pedals",
    category: "bicycle",
    description: {
      th: "ถนนเงียบ ๆ จังหวะร่วมกัน และการปั่นรอบเมือง",
      en: "Quiet streets, shared pace, and rides around the city.",
    },
    imageSrc: "/home/hero-journey.png",
  },
];

const filterOrder = ["all", "car", "motorcycle", "bicycle"] as const;

interface BrowserHomeState {
  readonly recent: RecentJourneyItem[];
  readonly joinedGroups: Set<string>;
}

type BrowserHomeAction =
  | { readonly type: "hydrate"; readonly state: BrowserHomeState }
  | { readonly type: "recent"; readonly items: RecentJourneyItem[] }
  | { readonly type: "joined"; readonly items: Set<string> };

function browserHomeReducer(
  state: BrowserHomeState,
  action: BrowserHomeAction,
): BrowserHomeState {
  if (action.type === "hydrate") return action.state;
  if (action.type === "recent") return { ...state, recent: action.items };
  return { ...state, joinedGroups: action.items };
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
  const [{ recent, joinedGroups }, dispatchBrowserState] = useReducer(
    browserHomeReducer,
    { recent: [], joinedGroups: new Set<string>() },
  );
  const [filter, setFilter] = useState<TrendingFilter>("all");
  const [postsReload, setPostsReload] = useState(0);
  const [eventsReload, setEventsReload] = useState(0);

  useEffect(() => {
    dispatchBrowserState({
      type: "hydrate",
      state: {
        recent: parseRecentJourneys(
          readHomeStorage(() => window.localStorage, RECENT_KEY),
        ),
        joinedGroups: readJoinedGroups(
          readHomeStorage(() => window.localStorage, GROUPS_KEY),
        ),
      },
    });
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

  function remember(kind: HomeFeatureKind, href: string) {
    const next = recordRecentJourney(recent, {
      kind,
      href,
      visitedAt: new Date().toISOString(),
    });
    dispatchBrowserState({ type: "recent", items: next });
    writeHomeStorage(
      () => window.localStorage,
      RECENT_KEY,
      JSON.stringify(next),
    );
  }

  function toggleGroup(id: string) {
    const next = new Set(joinedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeHomeStorage(
      () => window.localStorage,
      GROUPS_KEY,
      JSON.stringify([...next]),
    );
    dispatchBrowserState({ type: "joined", items: next });
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
      <FeatureSelection locale={locale} onNavigate={remember} />
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
      <GameSpotlight locale={locale} onNavigate={remember} />
      <GroupDiscovery
        joined={joinedGroups}
        locale={locale}
        onToggle={toggleGroup}
      />
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
      games: ["เกมส์", "กลับไปดูตัวอย่างเกมส์"],
      activities: ["กิจกรรม", "กลับไปสำรวจแผนที่"],
    },
    en: {
      community: ["Community", "Return to the conversation"],
      games: ["Games", "Return to the game preview"],
      activities: ["Activities", "Return to the map"],
    },
  } as const;
  const icons = { community: UsersThree, games: Play, activities: MapPin };
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

function GameSpotlight({
  locale,
  onNavigate,
}: {
  readonly locale: Locale;
  readonly onNavigate: (kind: HomeFeatureKind, href: string) => void;
}) {
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
        <PendingLink
          href="/games"
          onClick={() => onNavigate("games", "/games")}
        >
          <Play aria-hidden size={18} weight="fill" /> {text.gameAction}
        </PendingLink>
      </div>
    </section>
  );
}

function GroupDiscovery({
  joined,
  locale,
  onToggle,
}: {
  readonly joined: ReadonlySet<string>;
  readonly locale: Locale;
  readonly onToggle: (id: string) => void;
}) {
  const text = copy[locale];
  const icons = {
    car: Car,
    motorcycle: Motorcycle,
    bicycle: Bicycle,
    groups: UsersThree,
  };
  return (
    <section className={styles.groupsSection} aria-labelledby="groups-title">
      <div className={styles.sectionTopline}>
        <SectionHeading
          kicker={text.groupsKicker}
          title={text.groupsTitle}
          id="groups-title"
        />
        <span className={styles.demoBadge}>{text.demo}</span>
      </div>
      <div className={styles.groupRail}>
        {demoGroups.map((group, index) => {
          const Icon = icons[group.category];
          const selected = joined.has(group.id);
          return (
            <article className={styles.groupCard} key={group.id}>
              <div className={styles.groupCover}>
                <Image
                  alt=""
                  aria-hidden="true"
                  fill
                  loading="lazy"
                  sizes="(max-width: 759px) 78vw, 30vw"
                  src={group.imageSrc}
                  style={{
                    objectPosition: index === 2 ? "25% center" : "center",
                  }}
                />
              </div>
              <span className={styles.groupIcon}>
                <Icon aria-hidden size={22} />
              </span>
              <small>{group.category}</small>
              <h3>{group.name}</h3>
              <p>{group.description[locale]}</p>
              <button
                aria-pressed={selected}
                onClick={() => onToggle(group.id)}
                type="button"
              >
                {selected ? (
                  <Check aria-hidden size={17} weight="bold" />
                ) : null}
                {selected ? text.joined : text.join}
              </button>
            </article>
          );
        })}
      </div>
      <p className={styles.demoNote}>{text.groupsNote}</p>
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

function readJoinedGroups(value: string | null): Set<string> {
  if (!value) return new Set();
  try {
    const candidate: unknown = JSON.parse(value);
    if (!Array.isArray(candidate)) return new Set();
    const allowed = new Set(demoGroups.map((group) => group.id));
    return new Set(
      candidate.filter(
        (item): item is string => typeof item === "string" && allowed.has(item),
      ),
    );
  } catch {
    return new Set();
  }
}
