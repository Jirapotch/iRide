import type { EventDto, PostDto } from "@iride/types";
import { describe, expect, it } from "vitest";

import {
  filterTrendingPosts,
  parseRecentJourneys,
  readHomeStorage,
  recordRecentJourney,
  selectUpcomingEvents,
  writeHomeStorage,
} from "./home-domain";

const author = {
  id: "author-1",
  username: "rider",
  displayName: "Rider",
} as const;

function post(
  id: string,
  category: PostDto["communityCategory"],
  commentCount: number,
  createdAt: string,
): PostDto {
  return {
    id,
    body: `${id} story`,
    communityCategory: category,
    author,
    canEdit: false,
    commentCount,
    markerTags: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function event(id: string, startsAt: string): EventDto {
  return {
    id,
    kind: "trip",
    title: `${id} trip`,
    description: null,
    locationLabel: "Bangkok",
    latitude: 13.7563,
    longitude: 100.5018,
    destinationLabel: "Khao Yai",
    destinationLatitude: 14.439,
    destinationLongitude: 101.372,
    startsAt,
    endsAt: null,
    timezone: "Asia/Bangkok",
    vehicleKinds: ["car"],
    organizer: author,
    canEdit: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("home discovery domain", () => {
  it("ranks trending posts by conversation, then recency", () => {
    const items = [
      post("quiet", "car", 1, "2026-09-03T00:00:00.000Z"),
      post("older-busy", "motorcycle", 8, "2026-09-01T00:00:00.000Z"),
      post("newer-busy", "bicycle", 8, "2026-09-02T00:00:00.000Z"),
    ];

    expect(filterTrendingPosts(items, "all").map((item) => item.id)).toEqual([
      "newer-busy",
      "older-busy",
      "quiet",
    ]);
    expect(
      filterTrendingPosts(items, "motorcycle").map((item) => item.id),
    ).toEqual(["older-busy"]);
  });

  it("keeps only future activities and sorts the nearest first", () => {
    const now = new Date("2026-09-06T00:00:00.000Z");
    const items = [
      event("later", "2026-09-20T00:00:00.000Z"),
      event("past", "2026-09-05T23:59:59.000Z"),
      event("next", "2026-09-07T00:00:00.000Z"),
    ];

    expect(selectUpcomingEvents(items, now).map((item) => item.id)).toEqual([
      "next",
      "later",
    ]);
  });

  it("rejects malformed recent history instead of leaking invalid links", () => {
    expect(parseRecentJourneys("not json")).toEqual([]);
    expect(
      parseRecentJourneys(
        JSON.stringify([
          {
            kind: "community",
            href: "https://malicious.example",
            visitedAt: "2026-09-06T00:00:00.000Z",
          },
          {
            kind: "games",
            href: "/games",
            visitedAt: "not-a-date",
          },
          {
            kind: "activities",
            href: "/maps",
            visitedAt: "2026-09-06T00:00:00.000Z",
          },
        ]),
      ),
    ).toEqual([
      {
        kind: "activities",
        href: "/maps",
        visitedAt: "2026-09-06T00:00:00.000Z",
      },
    ]);
  });

  it("records the newest visit once and caps history at three items", () => {
    const existing = [
      {
        kind: "community" as const,
        href: "/community/groups",
        visitedAt: "2026-09-03T00:00:00.000Z",
      },
      {
        kind: "games" as const,
        href: "/games",
        visitedAt: "2026-09-04T00:00:00.000Z",
      },
      {
        kind: "activities" as const,
        href: "/maps",
        visitedAt: "2026-09-05T00:00:00.000Z",
      },
    ];

    expect(
      recordRecentJourney(existing, {
        kind: "community",
        href: "/community/groups",
        visitedAt: "2026-09-06T00:00:00.000Z",
      }),
    ).toEqual([
      {
        kind: "community",
        href: "/community/groups",
        visitedAt: "2026-09-06T00:00:00.000Z",
      },
      {
        kind: "activities",
        href: "/maps",
        visitedAt: "2026-09-05T00:00:00.000Z",
      },
      {
        kind: "games",
        href: "/games",
        visitedAt: "2026-09-04T00:00:00.000Z",
      },
    ]);
  });

  it("keeps Home usable when browser storage is unavailable", () => {
    expect(
      readHomeStorage(
        () => ({
          getItem: () => {
            throw new DOMException("Blocked", "SecurityError");
          },
        }),
        "recent",
      ),
    ).toBeNull();
    expect(
      writeHomeStorage(
        () => ({
          setItem: () => {
            throw new DOMException("Full", "QuotaExceededError");
          },
        }),
        "recent",
        "[]",
      ),
    ).toBe(false);
  });

  it("keeps Home usable when the localStorage getter itself is blocked", () => {
    const blockedStorage = () => {
      throw new DOMException("Blocked", "SecurityError");
    };

    expect(readHomeStorage(blockedStorage, "recent")).toBeNull();
    expect(writeHomeStorage(blockedStorage, "recent", "[]")).toBe(false);
  });
});
