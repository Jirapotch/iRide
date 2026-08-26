import { describe, expect, it, vi } from "vitest";

import { loadAllPages, migrateMediaReferences, type MediaReference } from "@/lib/media-migration";

const reference: MediaReference = {
  table: "posts",
  id: "post-1",
  column: "photo_path",
  bucket: "post-media",
  path: "user/photo.webp",
};

describe("media migration", () => {
  it("loads every deterministic page instead of stopping at Supabase's row cap", async () => {
    const fetchPage = vi.fn(async (from: number, to: number) => {
      expect(to - from).toBe(1);
      if (from === 0) return ["a", "b"];
      if (from === 2) return ["c", "d"];
      if (from === 4) return ["e"];
      return [];
    });

    await expect(loadAllPages(fetchPage, 2)).resolves.toEqual(["a", "b", "c", "d", "e"]);
    expect(fetchPage.mock.calls).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it("dry-run reports legacy references without reading or writing objects", async () => {
    const dependencies = {
      download: vi.fn(),
      head: vi.fn(),
      upload: vi.fn(),
      updatePath: vi.fn(),
    };

    const result = await migrateMediaReferences([reference], dependencies, { apply: false });

    expect(result).toEqual({ legacy: 1, alreadyMigrated: 0, copied: 0, reused: 0 });
    expect(dependencies.download).not.toHaveBeenCalled();
    expect(dependencies.updatePath).not.toHaveBeenCalled();
  });

  it("uploads, verifies, then marks a legacy row as R2", async () => {
    const source = { body: new Uint8Array([1, 2, 3]), size: 3, contentType: "image/webp" };
    const dependencies = {
      download: vi.fn().mockResolvedValue(source),
      head: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ size: 3, contentType: "image/webp" }),
      upload: vi.fn().mockResolvedValue(undefined),
      updatePath: vi.fn().mockResolvedValue(undefined),
    };

    const result = await migrateMediaReferences([reference], dependencies, { apply: true });

    expect(dependencies.upload).toHaveBeenCalledWith("post-media", "user/photo.webp", source);
    expect(dependencies.updatePath).toHaveBeenCalledWith(reference, "r2:user/photo.webp");
    expect(result).toEqual({ legacy: 1, alreadyMigrated: 0, copied: 1, reused: 0 });
  });

  it("reuses a matching destination and is resumable for marked rows", async () => {
    const matching = { size: 3, contentType: "image/webp" };
    const dependencies = {
      download: vi.fn().mockResolvedValue({ body: new Uint8Array([1, 2, 3]), ...matching }),
      head: vi.fn().mockResolvedValue(matching),
      upload: vi.fn(),
      updatePath: vi.fn().mockResolvedValue(undefined),
    };

    const result = await migrateMediaReferences([
      reference,
      { ...reference, id: "post-2", path: "r2:user/already.webp" },
    ], dependencies, { apply: true });

    expect(dependencies.upload).not.toHaveBeenCalled();
    expect(dependencies.updatePath).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ legacy: 1, alreadyMigrated: 1, copied: 0, reused: 1 });
  });

  it("stops without overwriting or updating the database when verification differs", async () => {
    const dependencies = {
      download: vi.fn().mockResolvedValue({ body: new Uint8Array([1, 2, 3]), size: 3, contentType: "image/webp" }),
      head: vi.fn().mockResolvedValue({ size: 2, contentType: "image/webp" }),
      upload: vi.fn(),
      updatePath: vi.fn(),
    };

    await expect(migrateMediaReferences([reference], dependencies, { apply: true })).rejects.toThrow(
      "R2 object mismatch for post-media/user/photo.webp",
    );
    expect(dependencies.upload).not.toHaveBeenCalled();
    expect(dependencies.updatePath).not.toHaveBeenCalled();
  });
});
