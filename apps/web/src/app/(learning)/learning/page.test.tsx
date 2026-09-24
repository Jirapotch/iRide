import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes } from "react";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/request-locale", () => ({ getRequestLocale: async () => "th" }));
vi.mock("@/features/navigation/components/pending-link", () => ({
  PendingLink: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));

import LearningPage from "./page";

it("introduces Engine Simulator as learning content without requiring login", async () => {
  const html = renderToStaticMarkup(await LearningPage());
  expect(html).toContain("สื่อความรู้");
  expect(html).toContain("Engine Simulator 3D");
  expect(html).toContain('href="/learning/engine-simulator"');
  expect(html).not.toContain("เข้าสู่ระบบ");
});
