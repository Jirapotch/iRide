import { afterEach, expect, test, vi } from "vitest";

import { getPosts } from "@/lib/content-api";
import { CommunityFeedSection } from "./community-data-sections";
import { SectionError } from "./section-error";

vi.mock("@/lib/content-api", () => ({
  getEvents: vi.fn(),
  getPost: vi.fn(),
  getPosts: vi.fn(),
}));
vi.mock("@/lib/profile-api", () => ({ getOwnProfile: vi.fn() }));
vi.mock("./community-screen", () => ({ CommunityScreen: () => null }));
vi.mock("./create-content-screen", () => ({ BackendForm: () => null }));
vi.mock("./edit-modal", () => ({ EditModal: () => null }));

afterEach(() => vi.clearAllMocks());

test("community API failure returns an error section, not an empty feed", async () => {
  vi.mocked(getPosts).mockRejectedValueOnce(new Error("offline"));

  const element = await CommunityFeedSection({
    accessToken: undefined,
    category: "car",
    locale: "en",
    room: "talk",
  });

  expect(element.type).toBe(SectionError);
  expect(element.props.title).toBe("Feed unavailable");
});
