import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Vehicle,
  VehicleInput,
  ServiceInput,
  ServiceRecord,
  VehiclePhoto,
  Page,
} from "@/features/garage/types";
import { GarageError } from "@/features/garage/validation";
import type { PhotoRepository } from "./photo-service";

type Row = Record<string, unknown>;
export function mapRow<T>(row: Row): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  ) as T;
}
function snake(row: object) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()),
      value,
    ]),
  );
}
function fail(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (
    ["VEHICLE_NOT_FOUND", "PHOTO_NOT_FOUND"].includes(error.message) ||
    error.code === "PGRST116"
  )
    throw new GarageError("NOT_FOUND", 404);
  if (["UPLOAD_IN_PROGRESS", "VEHICLE_DELETING"].includes(error.message))
    throw new GarageError(error.message, 409);
  console.error("GARAGE_DATABASE_FAILURE", { code: error.code });
  throw new GarageError("DATABASE_UNAVAILABLE", 503);
}
export class GarageRepository implements PhotoRepository {
  constructor(private db: SupabaseClient) {}
  async assertReady() {
    const { data, error } = await this.db.rpc("garage_schema_version");
    if (error || data !== "personal-garage-v1")
      throw new GarageError("DATABASE_NOT_READY", 503);
  }
  async vehicles(): Promise<Vehicle[]> {
    const { data, error } = await this.db
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id");
    fail(error);
    return (data ?? []).map((row) => mapRow<Vehicle>(row));
  }
  async vehicle(id: string): Promise<Vehicle> {
    const { data, error } = await this.db
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .single();
    fail(error);
    return mapRow<Vehicle>(data!);
  }
  async saveVehicle(input: VehicleInput, id?: string) {
    const query = id
      ? this.db
          .from("vehicles")
          .update(snake(input))
          .eq("id", id)
          .eq("deleting", false)
      : this.db.from("vehicles").insert(snake(input));
    const { data, error } = await query.select("*").single();
    fail(error);
    return mapRow<Vehicle>(data!);
  }
  async cover(vehicleId: string, photoId: string | null) {
    if (photoId) {
      const photo = await this.get(photoId);
      if (photo.vehicleId !== vehicleId || photo.status !== "ready")
        throw new GarageError("PHOTO_NOT_FOUND", 404);
    }
    const { data, error } = await this.db
      .from("vehicles")
      .update({ cover_photo_id: photoId })
      .eq("id", vehicleId)
      .eq("deleting", false)
      .select("*")
      .single();
    fail(error);
    return mapRow<Vehicle>(data!);
  }
  async services(
    vehicleId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<ServiceRecord>> {
    const { data, error, count } = await this.db
      .from("service_records")
      .select("*", { count: "exact" })
      .eq("vehicle_id", vehicleId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    fail(error);
    return {
      items: (data ?? []).map((row) => mapRow<ServiceRecord>(row)),
      total: count ?? 0,
      page,
      pageSize,
    };
  }
  async totalCost(vehicleId: string) {
    // Server-side aggregate keeps totals correct beyond PostgREST's row limit.
    const { data, error } = await this.db.rpc("vehicle_service_total", {
      p_vehicle_id: vehicleId,
    });
    fail(error);
    return Number(data ?? 0);
  }
  async saveService(vehicleId: string, input: ServiceInput, id?: string) {
    const vehicle = await this.vehicle(vehicleId);
    if (vehicle.deleting) throw new GarageError("VEHICLE_DELETING", 409);
    const query = id
      ? this.db
          .from("service_records")
          .update(snake(input))
          .eq("id", id)
          .eq("vehicle_id", vehicleId)
      : this.db
          .from("service_records")
          .insert({ ...snake(input), vehicle_id: vehicleId });
    const { data, error } = await query.select("*").single();
    fail(error);
    return mapRow<ServiceRecord>(data!);
  }
  async deleteService(vehicleId: string, id: string) {
    const { data, error } = await this.db
      .from("service_records")
      .delete()
      .eq("id", id)
      .eq("vehicle_id", vehicleId)
      .select("id");
    fail(error);
    if (!data?.length) throw new GarageError("NOT_FOUND", 404);
  }
  async reserve(vehicleId: string, name: string, mime: string, size: number) {
    const { data, error } = await this.db.rpc("reserve_vehicle_photo", {
      p_vehicle_id: vehicleId,
      p_name: name,
      p_mime: mime,
      p_bytes: size,
    });
    fail(error);
    return mapRow<VehiclePhoto>(data);
  }
  async finish(photoId: string, fileId: string) {
    const { data, error } = await this.db.rpc("finish_vehicle_photo", {
      p_photo_id: photoId,
      p_file_id: fileId,
    });
    fail(error);
    return mapRow<VehiclePhoto>(data);
  }
  async get(photoId: string) {
    const { data, error } = await this.db
      .from("vehicle_photos")
      .select("*")
      .eq("id", photoId)
      .single();
    fail(error);
    return mapRow<VehiclePhoto>(data!);
  }
  async list(vehicleId: string) {
    const { data, error } = await this.db
      .from("vehicle_photos")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at")
      .order("id");
    fail(error);
    return (data ?? []).map((row) => mapRow<VehiclePhoto>(row));
  }
  async remove(photoId: string) {
    const { error } = await this.db.rpc("remove_vehicle_photo", {
      p_photo_id: photoId,
    });
    fail(error);
  }
  async abandon(photoId: string) {
    await this.remove(photoId);
  }
  async beginDeleteVehicle(vehicleId: string) {
    const { error } = await this.db.rpc("begin_vehicle_delete", {
      p_vehicle_id: vehicleId,
    });
    fail(error);
    return this.list(vehicleId);
  }
  async deleteVehicle(vehicleId: string) {
    const { error } = await this.db
      .from("vehicles")
      .delete()
      .eq("id", vehicleId)
      .eq("deleting", true);
    fail(error);
  }
}
export function createRepository() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new GarageError("DATABASE_NOT_CONFIGURED", 503);
  return new GarageRepository(
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
}
