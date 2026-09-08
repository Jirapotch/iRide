"use client";

import type { EventDto } from "@iride/types";
import { useEffect, useRef, useState } from "react";

import { mapStyle, type AppTheme } from "@/lib/app-navigation-domain";
import { applyMapPalette } from "@/lib/map-palette";
import type { Locale } from "@/lib/locale";
import styles from "./home.module.css";

export function HomeMiniMap({
  event,
  locale,
}: {
  readonly event: EventDto;
  readonly locale: Locale;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        setLoadState("loading");
        observer.disconnect();
      },
      { rootMargin: "160px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = mapRootRef.current;
    if (!visible || !container) return;
    let disposed = false;
    let map: import("maplibre-gl").Map | null = null;

    void import("maplibre-gl")
      .then((maplibregl) => {
        if (disposed || !mapRootRef.current) return;
        const coordinates = routeCoordinates(event);
        const origin = coordinates[0]!;
        map = new maplibregl.Map({
          container: mapRootRef.current,
          style: mapStyle(process.env.NEXT_PUBLIC_MAPTILER_KEY),
          center: origin,
          zoom: coordinates.length > 1 ? 6.4 : 10,
          interactive: false,
          attributionControl: false,
        });
        map.once("load", () => {
          if (!map || disposed) return;
          const theme: AppTheme =
            document.documentElement.dataset.theme === "dark"
              ? "dark"
              : "light";
          applyMapPalette(map, theme);
          if (coordinates.length > 1) {
            map.addSource("home-route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates },
              },
            });
            map.addLayer({
              id: "home-route-line",
              type: "line",
              source: "home-route",
              paint: {
                "line-color": "#4f6f52",
                "line-width": 4,
                "line-opacity": 0.9,
              },
            });
            const bounds = coordinates.reduce(
              (value, coordinate) => value.extend(coordinate),
              new maplibregl.LngLatBounds(origin, origin),
            );
            map.fitBounds(bounds, {
              padding: 52,
              duration: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? 0
                : 420,
            });
          }
          setLoadState("ready");
        });
      })
      .catch(() => {
        if (!disposed) setLoadState("error");
      });

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [event, visible]);

  return (
    <div
      aria-label={
        locale === "th" ? "ตัวอย่างเส้นทางกิจกรรม" : "Activity route preview"
      }
      className={styles.miniMap}
      data-map-loaded={loadState === "ready" ? "true" : undefined}
      data-map-requested={visible ? "true" : undefined}
      data-ui="home-mini-map"
      ref={rootRef}
      role="img"
    >
      <div className={styles.miniMapCanvas} ref={mapRootRef} />
      {loadState === "error" ? (
        <span className={styles.mapError}>
          {locale === "th"
            ? "ไม่สามารถแสดงตัวอย่างแผนที่ได้"
            : "Map preview unavailable"}
        </span>
      ) : loadState !== "ready" ? (
        <span className={styles.mapPlaceholder} aria-hidden="true" />
      ) : null}
    </div>
  );
}

function routeCoordinates(event: EventDto): [number, number][] {
  const origin: [number, number] = [event.longitude, event.latitude];
  return event.destinationLongitude !== null &&
    event.destinationLatitude !== null
    ? [origin, [event.destinationLongitude, event.destinationLatitude]]
    : [origin];
}
