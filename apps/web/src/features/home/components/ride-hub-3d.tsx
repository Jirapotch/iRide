"use client";

import {
  ArrowCounterClockwise,
  ArrowRight,
  CalendarBlank,
  BookOpen,
  Cube,
  GameController,
  MapTrifold,
  Motorcycle,
  Minus,
  Plus,
  UsersThree,
} from "@phosphor-icons/react";
import { Button, Tooltip } from "antd";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { PendingLink } from "@/features/navigation/components/pending-link";
import type { Locale } from "@/lib/locale";
import {
  featureHref,
  RIDE_FEATURES,
  type RideFeature,
} from "../ride-hub/ride-hub-domain";
import type { RideHubScene } from "../ride-hub/ride-hub-scene";
import styles from "./ride-hub.module.css";

export type IRideRideHub3DProps = {
  height?: number | string;
  className?: string;
  embed?: boolean;
  locale?: Locale;
  onFeature?: (feature: RideFeature) => void;
  onReady?: () => void;
};

const icons = {
  community: UsersThree,
  activities: CalendarBlank,
  trips: Motorcycle,
  routes: MapTrifold,
  knowledge: BookOpen,
  games: GameController,
};
const labels = {
  th: {
    community: "ชุมชน",
    activities: "กิจกรรม",
    trips: "ทริป",
    routes: "เส้นทาง",
    knowledge: "สื่อความรู้",
    games: "เกมส์",
  },
  en: {
    community: "Community",
    activities: "Activities",
    trips: "Trips",
    routes: "Routes",
    knowledge: "Knowledge",
    games: "Games",
  },
};

export function IRideRideHub3D({
  height,
  className = "",
  embed = true,
  locale = "th",
  onFeature,
  onReady,
}: IRideRideHub3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RideHubScene | null>(null);
  const plaques = useRef<
    Partial<Record<RideFeature, HTMLButtonElement | null>>
  >({});
  const callbacks = useRef({ onFeature, onReady });
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [selected, setSelected] = useState<RideFeature>("trips");
  const [retry, setRetry] = useState(0);
  const state = useRef({ selected });
  useEffect(() => {
    state.current = { selected };
  }, [selected]);
  const text = labels[locale];
  const select = useCallback((feature: RideFeature) => {
    setSelected(feature);
    scene.current?.select(feature, false);
  }, []);
  useEffect(() => {
    callbacks.current = { onFeature, onReady };
  }, [onFeature, onReady]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let instance: RideHubScene | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        void import("../ride-hub/ride-hub-scene")
          .then(({ RideHubScene }) => {
            if (cancelled) return;
            try {
              instance = new RideHubScene(element, {
                embed,
                onSelect: select,
                onProject: (positions) => {
                  for (const position of positions) {
                    const label = plaques.current[position.feature];
                    if (!label) continue;
                    label.style.left = `${position.x}px`;
                    label.style.top = `${position.y}px`;
                    label.style.visibility = position.visible
                      ? "visible"
                      : "hidden";
                  }
                },
                onError: () => {
                  instance?.dispose();
                  scene.current = null;
                  if (!cancelled) setStatus("error");
                },
                onReady: () => {
                  if (!cancelled) callbacks.current.onReady?.();
                },
              });
              scene.current = instance;
              instance.select(state.current.selected, false);
              setStatus("ready");
            } catch {
              instance?.dispose();
              if (!cancelled) setStatus("error");
            }
          })
          .catch(() => {
            if (!cancelled) setStatus("error");
          });
      },
      { rootMargin: "150px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      instance?.dispose();
      scene.current = null;
    };
  }, [embed, retry, select]);

  const resetLabel = locale === "th" ? "กลับมุมเริ่มต้น" : "Reset view";
  const rootStyle =
    height === undefined
      ? undefined
      : ({
          "--ride-scene-height":
            typeof height === "number" ? `${height}px` : height,
        } as CSSProperties);
  return (
    <section
      aria-label={
        locale === "th" ? "สำรวจ iRide แบบ 3D" : "Explore iRide in 3D"
      }
      className={`${styles.root} ${className}`}
      data-ui="ride-hub"
      data-scene-status={status}
      style={rootStyle}
    >
      <h1 className="sr-only" data-route-heading id="home-title" tabIndex={-1}>
        iRide
      </h1>
      <div className={styles.stage}>
        <div
          ref={host}
          className={styles.canvas}
          role="img"
          aria-label={
            locale === "th"
              ? "ฐาน 3D ของชุมชน กิจกรรม ทริป เส้นทาง สื่อความรู้ และเกมส์"
              : "Interactive platform with community, activities, trips, routes, knowledge and games"
          }
        />
        {status === "ready"
          ? RIDE_FEATURES.map((feature) => (
              <button
                key={feature}
                ref={(element) => {
                  plaques.current[feature] = element;
                }}
                type="button"
                className={styles.plaque}
                data-feature={feature}
                aria-pressed={selected === feature}
                onClick={() => select(feature)}
              >
                {text[feature]}
                {selected === feature ? (
                  <ArrowRight size={14} aria-hidden />
                ) : null}
              </button>
            ))
          : null}
        {status !== "ready" ? (
          <div className={styles.fallback} role="status" aria-live="polite">
            <Image
              src="/assets/ride-hub-poster.png"
              alt=""
              fill
              sizes="100vw"
              className={styles.poster}
              unoptimized
              loading="eager"
            />
            <Cube size={40} weight="duotone" aria-hidden />
            <span>
              {status === "loading"
                ? locale === "th"
                  ? "กำลังเตรียมฉาก…"
                  : "Preparing your ride…"
                : locale === "th"
                  ? "ไม่สามารถเปิด 3D ได้"
                  : "3D view unavailable"}
            </span>
            {status === "error" ? (
              <Button
                onClick={() => {
                  setStatus("loading");
                  setRetry((value) => value + 1);
                }}
              >
                {locale === "th" ? "ลองอีกครั้ง" : "Retry"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={styles.bottom}>
        <div
          className={styles.features}
          role="group"
          aria-label={locale === "th" ? "เลือกฟีเจอร์" : "Choose a feature"}
        >
          {RIDE_FEATURES.map((feature) => {
            const Icon = icons[feature];
            return (
              <Button
                key={feature}
                type={selected === feature ? "primary" : "default"}
                icon={<Icon size={20} />}
                aria-pressed={selected === feature}
                onClick={() => select(feature)}
                data-ride-feature={feature}
              >
                {text[feature]}
              </Button>
            );
          })}
        </div>
        <div className={styles.actions}>
          <Tooltip title={resetLabel}>
            <Button
              icon={<ArrowCounterClockwise size={19} />}
              aria-label={resetLabel}
              onClick={() => {
                scene.current?.reset();
              }}
            />
          </Tooltip>
          <Button
            icon={<Minus size={18} />}
            aria-label={locale === "th" ? "ซูมออก" : "Zoom out"}
            onClick={() => scene.current?.changeZoom(-0.15)}
          />
          <Button
            icon={<Plus size={18} />}
            aria-label={locale === "th" ? "ซูมเข้า" : "Zoom in"}
            onClick={() => scene.current?.changeZoom(0.15)}
          />
          <PendingLink
            className={styles.open}
            href={featureHref(selected)}
            onClick={() => callbacks.current.onFeature?.(selected)}
          >
            {locale === "th" ? "เปิด" : "Open"}
            <ArrowRight size={18} aria-hidden />
            <span className="sr-only"> {text[selected]}</span>
          </PendingLink>
        </div>
      </div>
    </section>
  );
}
