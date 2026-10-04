import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes } from "react";
import { expect, test, vi } from "vitest";

vi.mock("@/features/navigation/components/pending-link", () => ({
  PendingLink: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));

import { HomeDiscovery } from "./home-discovery";

test("home content uses the app shell main landmark without nesting another", () => {
  const html = renderToStaticMarkup(
    <main id="main-content">
      <HomeDiscovery locale="en" />
    </main>,
  );
  expect(html.match(/<main\b/g)).toHaveLength(1);
  expect(html).toContain('id="home-title"');
  expect(html).toContain('data-ui="ride-hub"');
  expect(html).not.toContain("Every road has a story");
  expect(html).not.toContain("hero-journey.png");
});

test("home keeps all six features inside the hub without duplicate sections or scene controls", () => {
  const html = renderToStaticMarkup(<HomeDiscovery locale="th" />);
  expect(
    [...html.matchAll(/data-ride-feature="([^"]+)"/g)].map((match) => match[1]),
  ).toEqual([
    "community",
    "activities",
    "trips",
    "routes",
    "knowledge",
    "games",
  ]);
  expect(html).not.toContain("data-feature-card");
  expect(html).not.toContain("เลือกมุมมอง");
  expect(html).not.toContain("โหมดฉาก");
  expect(html).toContain("สื่อความรู้");
});
