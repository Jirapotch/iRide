import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { GarageRepository } from "./repository";
it("refuses Garage access while the target still has its legacy schema", async () => {
  const db = {
    rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } }),
  };
  await expect(
    new GarageRepository(db as unknown as SupabaseClient).assertReady(),
  ).rejects.toMatchObject({ code: "DATABASE_NOT_READY" });
});
it("allows a verified personal Garage baseline", async () => {
  const db = {
    rpc: vi.fn().mockResolvedValue({ data: "personal-garage-v1", error: null }),
  };
  await expect(
    new GarageRepository(db as unknown as SupabaseClient).assertReady(),
  ).resolves.toBeUndefined();
});
