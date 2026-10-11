import { describe, it, expect, vi } from "vitest";
import { PhotoService } from "./photo-service";
import { GarageError } from "@/features/garage/validation";
import type { PhotoRepository, PhotoStorage } from "./photo-service";
const vehicleId = "6d34bc84-8116-4ee5-b6db-c9204b90139b";
const photoId = "d9096a81-c4f8-4c4e-a340-3a0c67c488d2";
function setup() {
  const photo = {
    id: photoId,
    vehicleId,
    driveFileId: "owned-file",
    name: "car.jpg",
    mimeType: "image/jpeg",
    bytes: 4,
    createdAt: "",
    status: "ready" as const,
  };
  const repo = {
    reserve: vi.fn().mockResolvedValue(photo),
    finish: vi.fn().mockResolvedValue(photo),
    abandon: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(photo),
    remove: vi.fn().mockResolvedValue(undefined),
    beginDeleteVehicle: vi.fn().mockResolvedValue([photo]),
    deleteVehicle: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([photo]),
  } satisfies PhotoRepository;
  const storage = {
    upload: vi.fn().mockResolvedValue("owned-file"),
    trash: vi.fn().mockResolvedValue(undefined),
    read: vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([255, 216, 255, 224]))),
  } satisfies PhotoStorage;
  return { repo, storage, service: new PhotoService(repo, storage) };
}
describe("photo lifecycle across Drive and Postgres", () => {
  it("keeps an ambiguous upload reserved until reconciliation", async () => {
    const { repo, storage, service } = setup();
    storage.upload.mockRejectedValueOnce(
      new GarageError("UPLOAD_RECONCILE_REQUIRED", 503),
    );
    await expect(
      service.upload(
        vehicleId,
        "car.jpg",
        "image/jpeg",
        new Uint8Array([255, 216, 255, 224]),
      ),
    ).rejects.toThrow();
    expect(repo.abandon).not.toHaveBeenCalled();
  });
  it("reserves a photo before uploading, then commits its Drive ID", async () => {
    const { repo, storage, service } = setup();
    await service.upload(
      vehicleId,
      "car.jpg",
      "image/jpeg",
      new Uint8Array([255, 216, 255, 224]),
    );
    expect(repo.reserve).toHaveBeenCalledOnce();
    expect(repo.finish).toHaveBeenCalledOnce();
    expect(repo.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      storage.upload.mock.invocationCallOrder[0]!,
    );
  });
  it("compensates an uploaded file when metadata commit fails", async () => {
    const { repo, storage, service } = setup();
    repo.finish.mockRejectedValueOnce(new Error("database down"));
    await expect(
      service.upload(
        vehicleId,
        "car.jpg",
        "image/jpeg",
        new Uint8Array([255, 216, 255, 224]),
      ),
    ).rejects.toThrow();
    expect(storage.trash).toHaveBeenCalledWith("owned-file", vehicleId);
    expect(repo.abandon).toHaveBeenCalled();
  });
  it("retains metadata when Drive quota or credentials fail", async () => {
    const { repo, storage, service } = setup();
    storage.trash.mockRejectedValueOnce(new Error("credentials revoked"));
    await expect(service.remove(vehicleId, photoId)).rejects.toThrow();
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it("cannot remove another vehicle's photo", async () => {
    const { repo, storage, service } = setup();
    repo.get.mockResolvedValueOnce({
      ...(await repo.get(photoId)),
      vehicleId: "other",
    });
    await expect(service.remove(vehicleId, photoId)).rejects.toThrow();
    expect(storage.trash).not.toHaveBeenCalled();
  });
  it("does not delete a vehicle while any Drive cleanup fails", async () => {
    const { repo, storage, service } = setup();
    storage.trash.mockRejectedValueOnce(new Error("Drive unavailable"));
    await expect(service.removeVehicle(vehicleId)).rejects.toThrow();
    expect(repo.deleteVehicle).not.toHaveBeenCalled();
  });
  it("retains reservation for reconciliation if compensating cleanup also fails", async () => {
    const { repo, storage, service } = setup();
    repo.finish.mockRejectedValueOnce(new Error("db down"));
    storage.trash.mockRejectedValueOnce(new Error("Drive down"));
    await expect(
      service.upload(
        vehicleId,
        "car.jpg",
        "image/jpeg",
        new Uint8Array([255, 216, 255, 224]),
      ),
    ).rejects.toMatchObject({ code: "UPLOAD_RECONCILE_REQUIRED" });
    expect(repo.abandon).not.toHaveBeenCalled();
  });
});
