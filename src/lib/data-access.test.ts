import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  processUploadedImage: vi.fn(),
}));

vi.mock("@/lib/media-storage", () => ({
  getR2MediaStorage: () => ({ upload: mocks.upload, remove: mocks.remove }),
  toR2Path: (key: string) => `r2:${key}`,
  parseMediaPath: (path: string) => path.startsWith("r2:")
    ? { provider: "r2", key: path.slice(3) }
    : { provider: "supabase", key: path },
}));
vi.mock("@/lib/image-processing", () => ({
  processUploadedImage: mocks.processUploadedImage,
}));

import { insertVehicle, removeMedia } from "@/lib/data-access";

describe("R2 data access integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.processUploadedImage.mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
      extension: "webp",
    });
  });

  it("stores the R2 marker after a new upload", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) };

    await insertVehicle(supabase as never, { owner_id: "user-1", nickname: "Bike" } as never, imageFile());

    expect(mocks.upload).toHaveBeenCalledWith("vehicle-media", expect.stringMatching(/^user-1\/[\w-]+\.webp$/), expect.any(Uint8Array), "image/webp");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ cover_path: expect.stringMatching(/^r2:user-1\/[\w-]+\.webp$/) }));
  });

  it("removes the newly uploaded R2 object when the database write fails", async () => {
    const insert = vi.fn().mockResolvedValue({ error: new Error("database unavailable") });
    const supabase = { from: vi.fn(() => ({ insert })) };

    await expect(insertVehicle(supabase as never, { owner_id: "user-1", nickname: "Bike" } as never, imageFile())).rejects.toThrow("database unavailable");

    expect(mocks.remove).toHaveBeenCalledWith("vehicle-media", expect.stringMatching(/^user-1\/[\w-]+\.webp$/));
  });

  it("routes deletion of an unprefixed path to Supabase Storage", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const supabase = { storage: { from: vi.fn(() => ({ remove })) } };

    await removeMedia(supabase as never, "post-media", "user/legacy.webp");

    expect(remove).toHaveBeenCalledWith(["user/legacy.webp"]);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

function imageFile() {
  return new File([new Uint8Array([1])], "vehicle.png", { type: "image/png" });
}
