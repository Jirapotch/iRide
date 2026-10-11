import {
  GarageError,
  vehicleInput,
  serviceInput,
  coverInput,
  pageInput,
  uuid,
  MAX_IMAGE_BYTES,
} from "@/features/garage/validation";
import type { VehiclePhoto } from "@/features/garage/types";
import type { GarageRepository } from "./repository";
import type { PhotoService } from "./photo-service";

function publicPhoto(photo: VehiclePhoto) {
  const { driveFileId: _fileId, ...result } = photo;
  void _fileId;
  return result;
}
async function body(request: Request, limit = 24000) {
  const reader = request.body?.getReader();
  if (!reader) throw new GarageError("EMPTY_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new GarageError("BODY_TOO_LARGE", 413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, cursor);
    cursor += chunk.length;
  }
  return bytes;
}
async function json(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new GarageError("JSON_REQUIRED", 415);
  try {
    return JSON.parse(new TextDecoder().decode(await body(request)));
  } catch (error) {
    if (error instanceof GarageError) throw error;
    throw new GarageError("INVALID_JSON");
  }
}
function result(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function handleGarage(
  request: Request,
  path: string[],
  repo: GarageRepository,
  photos: PhotoService,
): Promise<Response> {
  try {
    const method = request.method,
      url = new URL(request.url);
    if (
      path[0] === "photos" &&
      path.length === 3 &&
      path[2] === "content" &&
      method === "GET"
    ) {
      const response = await photos.content(uuid(path[1]!));
      return new Response(response.body, {
        headers: {
          "Content-Type":
            response.headers.get("content-type") ?? "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=60",
        },
      });
    }
    if (path[0] !== "vehicles") throw new GarageError("NOT_FOUND", 404);
    if (path.length === 1) {
      if (method === "GET") return result(await repo.vehicles());
      if (method === "POST")
        return result(
          await repo.saveVehicle(vehicleInput(await json(request))),
          201,
        );
      throw new GarageError("METHOD_NOT_ALLOWED", 405);
    }
    const id = uuid(path[1]!);
    if (path.length === 2) {
      if (method === "GET") {
        const paging = pageInput(url.searchParams);
        const [vehicle, services, images, totalCost] = await Promise.all([
          repo.vehicle(id),
          repo.services(id, paging.page, paging.pageSize),
          repo.list(id),
          repo.totalCost(id),
        ]);
        return result({
          vehicle,
          services,
          photos: images.filter((p) => p.status === "ready").map(publicPhoto),
          totalCost,
        });
      }
      if (method === "PATCH") {
        const input = await json(request);
        return result(
          input && typeof input === "object" && "coverPhotoId" in input
            ? await repo.cover(id, coverInput(input))
            : await repo.saveVehicle(vehicleInput(input), id),
        );
      }
      if (method === "DELETE") {
        await photos.removeVehicle(id);
        return result({ ok: true });
      }
    }
    if (path[2] === "services" && path.length <= 4) {
      if (path.length === 3 && method === "GET") {
        await repo.vehicle(id);
        const p = pageInput(url.searchParams);
        return result(await repo.services(id, p.page, p.pageSize));
      }
      if (path.length === 3 && method === "POST")
        return result(
          await repo.saveService(id, serviceInput(await json(request))),
          201,
        );
      if (path.length === 4) {
        const record = uuid(path[3]!);
        if (method === "PATCH")
          return result(
            await repo.saveService(
              id,
              serviceInput(await json(request)),
              record,
            ),
          );
        if (method === "DELETE") {
          await repo.deleteService(id, record);
          return result({ ok: true });
        }
      }
    }
    if (path[2] === "photos" && path.length <= 4) {
      if (path.length === 3 && method === "GET") {
        await repo.vehicle(id);
        return result(
          (await repo.list(id))
            .filter((p) => p.status === "ready")
            .map(publicPhoto),
        );
      }
      if (path.length === 3 && method === "POST") {
        const bytes = await body(request, MAX_IMAGE_BYTES + 24000);
        let form: FormData;
        try {
          form = await new Response(bytes, {
            headers: {
              "Content-Type": request.headers.get("content-type") ?? "",
            },
          }).formData();
        } catch {
          throw new GarageError("MULTIPART_REQUIRED");
        }
        const files = form.getAll("file");
        if (files.length !== 1 || !(files[0] instanceof File))
          throw new GarageError("ONE_IMAGE_REQUIRED");
        const file = files[0];
        return result(
          publicPhoto(
            await photos.upload(
              id,
              file.name,
              file.type,
              new Uint8Array(await file.arrayBuffer()),
            ),
          ),
          201,
        );
      }
      if (path.length === 4 && method === "DELETE") {
        await photos.remove(id, uuid(path[3]!));
        return result({ ok: true });
      }
    }
    throw new GarageError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof GarageError)
      return result({ error: { code: error.code } }, error.status);
    console.error(
      "GARAGE_REQUEST_FAILED",
      error instanceof Error ? error.name : "Unknown",
    );
    return result({ error: { code: "SERVICE_UNAVAILABLE" } }, 503);
  }
}
