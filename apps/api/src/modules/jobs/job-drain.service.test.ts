import { afterEach, expect, it, vi } from "vitest";

import { JobDrainService } from "./job-drain.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("drains serverless job queues without a direct database URL", async () => {
  const config = {
    SUPABASE_URL: "https://storage.test",
    SUPABASE_PUBLISHABLE_KEY: "public",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    CORS_ALLOWED_ORIGINS: "https://app.test",
    CLOUDFLARE_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "r2",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "legacy",
  };
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
  vi.stubEnv("DATABASE_URL", undefined);
  const fetch = vi.fn(async () => Response.json([]));
  vi.stubGlobal("fetch", fetch);

  const result = await new JobDrainService().drain({
    deadlineMs: 45_000,
    batchSizePerQueue: 2,
  });

  expect(result).toEqual({ processed: 0, failed: 0, archived: 0 });
  expect(fetch).toHaveBeenCalledTimes(2);
});
