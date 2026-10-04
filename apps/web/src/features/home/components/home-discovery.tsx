"use client";

import { useEffect, useReducer } from "react";
import {
  parseRecentJourneys,
  readHomeStorage,
  recordRecentJourney,
  writeHomeStorage,
  type RecentJourneyItem,
  type RecentJourneyKind,
} from "@/lib/home-domain";
import type { Locale } from "@/lib/locale";
import { IRideRideHub3D } from "./ride-hub-3d";
import styles from "./home.module.css";

const RECENT_KEY = "iride.home.recent.v1";
function recentJourneyReducer(
  _state: RecentJourneyItem[],
  items: RecentJourneyItem[],
) {
  return items;
}

export function HomeDiscovery({ locale }: { readonly locale: Locale }) {
  const [recent, setRecent] = useReducer(recentJourneyReducer, []);
  useEffect(() => {
    setRecent(
      parseRecentJourneys(
        readHomeStorage(() => window.localStorage, RECENT_KEY),
      ),
    );
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
    <div className={styles.home}>
      <IRideRideHub3D
        locale={locale}
        embed
        onFeature={(feature) => {
          if (
            feature === "community" ||
            feature === "activities" ||
            feature === "knowledge" ||
            feature === "games"
          )
            remember(feature, `/${feature}`);
        }}
      />
    </div>
  );
}
