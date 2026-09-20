import { afterEach, expect, it, vi } from "vitest";
import { getWorkerEnv } from "@iride/config/worker";
import { createMediaProcessingJobDependencies } from "./media-processing.job";
import { createMediaCleanupJobDependencies } from "./media-cleanup.job";

const env = getWorkerEnv({
  SUPABASE_URL: "https://storage.test",
  SUPABASE_PUBLISHABLE_KEY: "public",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  CORS_ALLOWED_ORIGINS: "https://app.test",
  CLOUDFLARE_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "r2",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "legacy",
  DATABASE_URL: "postgresql://test:test@localhost/test",
});
afterEach(() => vi.unstubAllGlobals());

it("does not download or rewrite variants on a duplicate ready processing message", async () => {
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    requests.push(`${init.method ?? "GET"} ${url}`);
    if (
      String(url).includes("/rest/v1/media?") &&
      (init.method ?? "GET") === "GET"
    )
      return Response.json({
        status: "ready",
        deleted_at: null,
        original_object_key: null,
      });
    throw new Error("unexpected mutation or object download");
  });
  await expect(
    createMediaProcessingJobDependencies(env).process({
      version: 1,
      jobId: "j",
      idempotencyKey: "m:process",
      attempt: 1,
      mediaId: "m",
      ownerId: "u",
      purpose: "avatar",
      objectKey: "source",
      storageProvider: "supabase",
    }),
  ).resolves.toBeUndefined();
  expect(requests).toHaveLength(1);
});

it("persists confirmed cleanup only against the matching provider and source key", async () => {
  let query: URL | undefined, payload: unknown;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    query = new URL(url);
    payload = JSON.parse(init.body as string);
    return Response.json([{ id: "m" }]);
  });
  await createMediaCleanupJobDependencies(env).clearSource!(
    "m",
    "source",
    "supabase",
  );
  expect(query?.searchParams.get("id")).toBe("eq.m");
  expect(query?.searchParams.get("original_object_key")).toBe("eq.source");
  expect(query?.searchParams.get("storage_provider")).toBe("eq.supabase");
  expect(payload).toEqual({
    original_object_key: null,
    original_cleaned_at: expect.any(String),
  });
});

it("rejects cleanup persistence when the guarded update matches no media row", async () => {
  vi.stubGlobal("fetch", async () => Response.json([]));

  await expect(
    createMediaCleanupJobDependencies(env).clearSource!(
      "m",
      "source",
      "supabase",
    ),
  ).rejects.toThrow("MEDIA_SOURCE_CLEANUP_CONFLICT");
});
