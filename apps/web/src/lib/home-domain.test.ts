import { expect, it } from "vitest";

import { parseRecentJourneys } from "./home-domain";

it("recognizes the activities list as the Home activities destination", () => {
  expect(
    parseRecentJourneys(
      JSON.stringify([
        {
          kind: "activities",
          href: "/activities",
          visitedAt: "2026-09-08T00:00:00.000Z",
        },
        {
          kind: "activities",
          href: "/maps",
          visitedAt: "2026-09-07T00:00:00.000Z",
        },
      ]),
    ),
  ).toEqual([
    {
      kind: "activities",
      href: "/activities",
      visitedAt: "2026-09-08T00:00:00.000Z",
    },
  ]);
});
