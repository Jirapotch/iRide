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
  expect(html).toContain("Every road has a story");
});

test("home feature cards lead to all four destinations in the requested order", () => {
  const html = renderToStaticMarkup(<HomeDiscovery locale="th" />);
  const cards = [
    ...html.matchAll(/data-feature-card="([^"]+)"[^>]*href="([^"]+)"/g),
  ];
  expect(cards.map((card) => [card[1], card[2]])).toEqual([
    ["community", "/community"],
    ["activities", "/activities"],
    ["learning", "/learning"],
    ["games", "/games"],
  ]);
  expect(html).toContain("สื่อความรู้");
});
