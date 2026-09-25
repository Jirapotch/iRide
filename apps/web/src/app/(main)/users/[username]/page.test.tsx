import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { StoreProvider } from "@/store/provider";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  usePathname: () => "/users/river_rider",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=garage"),
}));
vi.mock("@/lib/auth-session", () => ({
  getVerifiedWebSession: vi.fn(async () => null),
}));
vi.mock("@/lib/request-locale", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));
vi.mock("@/lib/profile-api", () => ({
  getOwnProfile: vi.fn(),
  getPublicProfile: vi.fn(async () => ({
    avatarMediaId: null,
    bio: "Riding every weekend.",
    coverMediaId: null,
    createdAt: "2026-09-12T00:00:00.000Z",
    displayName: "River Rider",
    id: "profile-1",
    locationName: "Bangkok",
    updatedAt: "2026-09-12T00:00:00.000Z",
    username: "river_rider",
    visibility: "public",
  })),
}));
vi.mock("./profile-tab-content", () => ({
  ProfileTabContent: () => {
    throw new Promise<never>(() => undefined);
  },
}));

import UserProfilePage from "./page";

test("the committed profile shell keeps its header and a busy target fallback while tab content is suspended", async () => {
  const page = await UserProfilePage({
    params: Promise.resolve({ username: "river_rider" }),
    searchParams: Promise.resolve({ tab: "garage" }),
  });

  const markup = renderToStaticMarkup(<StoreProvider>{page}</StoreProvider>);

  expect(markup.match(/<h1[^>]*>River Rider<\/h1>/g)).toHaveLength(1);
  expect(markup).toContain('aria-busy="true"');
  expect(markup).toContain('data-ui="profile-tab-skeleton"');
  expect(markup).toContain('data-skeleton-tab="garage"');
  expect(markup).not.toContain('data-ui="profile-skeleton"');
});
