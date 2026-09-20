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
