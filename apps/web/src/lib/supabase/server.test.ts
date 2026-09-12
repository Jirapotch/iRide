import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(() => ({ auth: {} })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

import { createServerSupabaseClient } from "./server";

describe("server Supabase client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  });

  it("appends the PKCE flow id to OAuth callback redirects", async () => {
    await createServerSupabaseClient();

    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "public-key",
      expect.objectContaining({
        auth: {
          experimental: { appendPkceFlowIdToRedirects: true },
        },
      }),
    );
  });
});
