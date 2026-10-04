import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { StoreProvider } from "@/store/provider";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile, getPublicProfile } from "@/lib/profile-api";
import type { OwnProfileDto } from "@iride/types";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
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

test("an owner identity URL redirects to profile before requesting public data", async () => {
  vi.mocked(getPublicProfile).mockClear();
  vi.mocked(getVerifiedWebSession).mockResolvedValueOnce({
    userId: "profile-1",
    accessToken: "token",
  });
  vi.mocked(getOwnProfile).mockResolvedValueOnce({
    username: "river_rider",
  } as OwnProfileDto);
  await expect(
    UserProfilePage({
      params: Promise.resolve({ username: "river_rider" }),
      searchParams: Promise.resolve({
        tab: "garage",
        vehicle: "vehicle-1",
        modal: "report",
        section: "documents",
      }),
    }),
  ).rejects.toThrow(
    "REDIRECT:/profile?tab=garage&vehicle=vehicle-1&modal=report&section=documents",
  );
  expect(getPublicProfile).not.toHaveBeenCalled();
});

test("a logged-in viewer keeps another user's public route", async () => {
  vi.mocked(getVerifiedWebSession).mockResolvedValueOnce({
    userId: "viewer",
    accessToken: "token",
  });
  vi.mocked(getOwnProfile).mockResolvedValueOnce({
    username: "viewer",
  } as OwnProfileDto);
  const page = await UserProfilePage({
    params: Promise.resolve({ username: "river_rider" }),
    searchParams: Promise.resolve({ tab: "garage" }),
  });
  const markup = renderToStaticMarkup(<StoreProvider>{page}</StoreProvider>);
  expect(markup).toContain("/users/river_rider?tab=garage");
  expect(markup).not.toContain("Edit profile");
});
