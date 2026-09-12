import { expect, it } from "vitest";
import { SupabaseMediaStorage20260912155026 } from "./20260912155026-supabase-media-storage";

it("refuses a rollback that would discard object routing and cleanup metadata", async () => {
  await expect(new SupabaseMediaStorage20260912155026().down()).rejects.toThrow(
    "Use a forward migration",
  );
});
