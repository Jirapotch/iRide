import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminDatabaseClient } from "./admin";
import { createBrowserDatabaseClient } from "./browser";
import { createServerDatabaseClient } from "./server";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ kind: "mock-supabase-client" })),
}));

const url = "https://foundation.supabase.co";
const publishableKey = "sb_publishable_test";

describe("database clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a browser client with browser session persistence", () => {
    createBrowserDatabaseClient({ publishableKey, url });

    expect(createClient).toHaveBeenCalledWith(url, publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  });

  it("creates an RLS-scoped server client with a bearer token", () => {
    createServerDatabaseClient({
      accessToken: "caller-token",
      publishableKey,
      url,
    });

    expect(createClient).toHaveBeenCalledWith(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { headers: { Authorization: "Bearer caller-token" } },
    });
  });

  it("creates a non-persistent admin client with the service-role key", () => {
    createAdminDatabaseClient({ serviceRoleKey: "service-role", url });

    expect(createClient).toHaveBeenCalledWith(url, "service-role", {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  });

  it("rejects blank credentials before constructing a client", () => {
    expect(() =>
      createBrowserDatabaseClient({ publishableKey: " ", url }),
    ).toThrow("Supabase publishable key is required");
    expect(createClient).not.toHaveBeenCalled();
  });
});
