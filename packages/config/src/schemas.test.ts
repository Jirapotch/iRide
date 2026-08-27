import { describe, expect, it } from "vitest";

import { publicEnvSchema, serverEnvSchema, workerEnvSchema } from "./schemas";

const serverConfig = {
  SUPABASE_URL: "https://foundation.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000",
  CLOUDFLARE_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET: "test-bucket",
  OPN_SECRET_KEY: "skey_test",
  OPN_WEBHOOK_SECRET: "test-webhook-secret",
};

describe("environment schemas", () => {
  it("provides local defaults for public app URLs", () => {
    expect(publicEnvSchema.parse({})).toMatchObject({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_API_URL: "http://localhost:3001",
    });
  });

  it("fails fast when a server secret is missing", () => {
    expect(() =>
      serverEnvSchema.parse({
        ...serverConfig,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      }),
    ).toThrow();
  });

  it("defaults the worker health port", () => {
    expect(workerEnvSchema.parse(serverConfig).WORKER_PORT).toBe(3002);
  });
});
