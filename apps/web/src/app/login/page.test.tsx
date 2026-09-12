import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-session", () => ({
  getVerifiedWebSession: vi.fn(async () => null),
}));
vi.mock("@/lib/request-locale", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));
vi.mock("../_components/standalone-shell", () => ({
  StandaloneShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../auth/submit-button", () => ({
  AuthSubmitButton: ({ idleLabel }: { idleLabel: string }) =>
    createElement("button", { type: "submit" }, idleLabel),
}));
vi.mock("../language-switcher", () => ({
  LanguageSwitcher: () => null,
}));

import LoginPage from "./page";

it("renders a progressively enhanced GET form for starting Google OAuth", async () => {
  const page = await LoginPage({
    searchParams: Promise.resolve({
      next: "/garage?tab=vehicles",
      intent: "profile",
    }),
  });

  const html = renderToStaticMarkup(page);
  expect(html).toContain('<form action="/auth/google/start" method="get">');
  expect(html).toContain(
    '<input type="hidden" name="next" value="/garage?tab=vehicles"/>',
  );
  expect(html).toContain(
    '<input type="hidden" name="intent" value="profile"/>',
  );
});
