import type { VehiclePhoto } from "@/features/garage/types";
import { GarageError, validateImage } from "@/features/garage/validation";

export interface PhotoRepository {
  reserve(
    vehicleId: string,
    name: string,
    mime: string,
    size: number,
  ): Promise<VehiclePhoto>;
  finish(photoId: string, fileId: string): Promise<VehiclePhoto>;
  abandon(photoId: string): Promise<void>;
  get(photoId: string): Promise<VehiclePhoto>;
  remove(photoId: string): Promise<void>;
  list(vehicleId: string): Promise<VehiclePhoto[]>;
  beginDeleteVehicle(vehicleId: string): Promise<VehiclePhoto[]>;
  deleteVehicle(vehicleId: string): Promise<void>;
}
export interface PhotoStorage {
  upload(
    vehicleId: string,
    photoId: string,
    name: string,
    mime: string,
    bytes: Uint8Array,
  ): Promise<string>;
  trash(fileId: string, vehicleId: string): Promise<void>;
  read(fileId: string, vehicleId: string): Promise<Response>;
}
export class PhotoService {
  constructor(
    private repo: PhotoRepository,
    private storage: PhotoStorage,
  ) {}
  async upload(
    vehicleId: string,
    name: string,
    mime: string,
    bytes: Uint8Array,
  ) {
    validateImage(bytes, mime);
    const photo = await this.repo.reserve(
      vehicleId,
      name.slice(0, 160),
      mime,
      bytes.length,
    );
    let fileId: string | null = null;
    try {
      fileId = await this.storage.upload(
        vehicleId,
        photo.id,
        name,
        mime,
        bytes,
      );
      return await this.repo.finish(photo.id, fileId);
    } catch (error) {
      if (
        !fileId &&
        error instanceof GarageError &&
        error.code === "UPLOAD_RECONCILE_REQUIRED"
      ) {
        console.error("PHOTO_RECONCILE_REQUIRED", {
          photoId: photo.id,
          vehicleId,
        });
        throw error;
      }
      try {
        if (fileId) await this.storage.trash(fileId, vehicleId);
        await this.repo.abandon(photo.id);
      } catch {
        // Keep the reservation. Drive tags let the maintenance tool reconcile it.
        console.error("PHOTO_RECONCILE_REQUIRED", {
          photoId: photo.id,
          vehicleId,
          fileId,
        });
        throw new GarageError("UPLOAD_RECONCILE_REQUIRED", 503);
      }
      throw error;
    }
  }
  async remove(vehicleId: string, photoId: string) {
    const photo = await this.repo.get(photoId);
    if (
      photo.vehicleId !== vehicleId ||
      photo.status !== "ready" ||
      !photo.driveFileId
    )
      throw new GarageError("PHOTO_NOT_FOUND", 404);
    await this.storage.trash(photo.driveFileId, vehicleId);
    await this.repo.remove(photoId);
  }
  async removeVehicle(vehicleId: string) {
    const photos = await this.repo.beginDeleteVehicle(vehicleId);
    for (const photo of photos) {
      if (!photo.driveFileId) throw new GarageError("UPLOAD_IN_PROGRESS", 409);
      await this.storage.trash(photo.driveFileId, vehicleId);
      await this.repo.remove(photo.id);
    }
    await this.repo.deleteVehicle(vehicleId);
  }
  async content(photoId: string) {
    const photo = await this.repo.get(photoId);
    if (!photo.driveFileId || photo.status !== "ready")
      throw new GarageError("PHOTO_NOT_FOUND", 404);
    return this.storage.read(photo.driveFileId, photo.vehicleId);
  }
}
