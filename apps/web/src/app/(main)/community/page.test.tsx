import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { AnchorHTMLAttributes } from "react";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/request-locale", () => ({
  getRequestLocale: async () => "en",
}));
vi.mock("@/features/navigation/components/pending-link", () => ({
  PendingLink: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));

import CommunityPage from "./page";

test("community exposes one page heading inside the existing app main landmark", async () => {
  const html = renderToStaticMarkup(
    <main id="main-content">{await CommunityPage()}</main>,
  );
  expect(html.match(/<main\b/g)).toHaveLength(1);
  expect(html).toMatch(
    /<h1[^>]*data-route-heading[^>]*>Explore community<\/h1>/,
  );
  expect(html.match(/<h2\b/g)).toHaveLength(4);
  expect(html).toContain('data-kind="car"');
  expect(html).toContain('data-kind="motorcycle"');
  expect(html).toContain('data-kind="bicycle"');
  expect(html).toContain('data-kind="group"');
  expect(html).toContain('href="/community/motorcycle"');
  expect(html).toContain('aria-label="View Motorcycles community"');
});

test("community keeps decorative accents separate from accessible text colors", () => {
  const css = readFileSync(
    new URL("./community.module.css", import.meta.url),
    "utf8",
  );
  expect(css).toContain("--community-accent-text:");
  expect(css).toContain("color: var(--community-accent-text)");
});
