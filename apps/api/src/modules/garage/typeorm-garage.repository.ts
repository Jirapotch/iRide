import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { createSupabaseStorage } from "@iride/storage";
import type {
  GarageSummaryDto,
  OwnerVehicleDto,
  OwnershipTransferDto,
  VehicleDocumentDto,
  VehicleRecordDto,
} from "@iride/types";
import { withActorTransaction } from "../../database/actor-transaction";
import { RuntimeDatabaseService } from "../../database/runtime-database.service";
import {
  garageFailure,
  type GarageOperation,
  type GarageRepository,
} from "../../lib/garage";
import {
  createGarageDocumentStorage,
  sanitizeGarageDocumentFilename,
  type GarageDocumentStorage,
} from "../../lib/garage-document-storage";

type VehicleRow = {
  id: string;
  owner_id: string;
  kind: OwnerVehicleDto["kind"];
  brand: string;
  model: string;
  year: number | null;
  nickname: string | null;
  description: string | null;
  visibility: OwnerVehicleDto["visibility"];
  mileage_km: number | null;
  next_service_km: number | null;
  next_service_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  username: string;
  display_name: string;
};
type RecordRow = {
  id: string;
  vehicle_id: string;
  kind: VehicleRecordDto["kind"];
  title: string;
  occurred_on: string;
  mileage_km: number | null;
  description: string | null;
  workshop_name: string | null;
  created_at: string;
  updated_at: string;
  vehicle_label: string;
};
type DocumentRow = {
  id: string;
  vehicle_id: string;
  record_id: string | null;
  owner_id: string;
  filename: string;
  mime_type: string;
  bytes: number;
  object_key: string | null;
  media_id: string | null;
  created_at: string;
};
type TransferRow = {
  id: string;
  vehicle_id: string;
  vehicle_label: string;
  from_username: string;
  to_username: string;
  status: OwnershipTransferDto["status"];
  expires_at: string;
  document_ids: string[];
  created_at: string;
};

@Injectable()
export class TypeOrmGarageRepository implements GarageRepository {
  private storage: GarageDocumentStorage | undefined;
  private imageStorage: ReturnType<typeof createSupabaseStorage> | undefined;
  constructor(private readonly database: RuntimeDatabaseService) {}

  async run(userId: string, operation: GarageOperation): Promise<unknown> {
    // Document metadata is service managed, so direct Data API writes cannot
    // bypass server file validation. Actor identity remains explicit throughout.
    const role =
      operation.kind === "uploadDocument" ||
      operation.kind === "deleteDocument" ||
      operation.kind === "downloadDocument"
        ? "service_role"
        : "authenticated";
    return withActorTransaction(
      this.database,
      { role, userId },
      async (manager) => {
        const access = await manager.query<
          { status: string; transition_id: string | null }[]
        >(
          "select status, transition_id from public.account_access where user_id=$1",
          [userId],
        );
        if (
          !access[0] ||
          access[0].status === "suspended" ||
          access[0].transition_id !== null
        )
          throw garageFailure("GARAGE_FORBIDDEN", 403);
        if (
          ![
            "garage",
            "summary",
            "vehicle",
            "records",
            "documents",
            "transfers",
            "downloadDocument",
          ].includes(operation.kind) &&
          access[0].status !== "active"
        )
          throw garageFailure("GARAGE_FORBIDDEN", 403);
        switch (operation.kind) {
          case "garage":
            return this.vehicles(
              manager,
              userId,
              undefined,
              access[0].status === "active",
            );
          case "summary":
            return this.summary(manager, userId, access[0].status === "active");
          case "transfers":
            return this.transfers(manager, userId);
          case "vehicle": {
            await this.ownerVehicle(manager, userId, operation.vehicleId);
            return (
              await this.vehicles(
                manager,
                userId,
                operation.vehicleId,
                access[0].status === "active",
              )
            )[0];
          }
          case "records": {
            await this.ownerVehicle(manager, userId, operation.vehicleId);
            return this.records(manager, userId, operation.vehicleId);
          }
          case "documents": {
            await this.ownerVehicle(manager, userId, operation.vehicleId);
            return (
              await this.documentRows(manager, userId, operation.vehicleId)
            ).map(documentDto);
          }
          case "updateVehicle": {
            await this.ownerVehicle(manager, userId, operation.vehicleId, true);
            const fields = Object.entries(operation.input).map(
              ([key, value]) =>
                [
                  (
                    {
                      mileageKm: "mileage_km",
                      nextServiceKm: "next_service_km",
                      nextServiceDate: "next_service_date",
                    } as Record<string, string>
                  )[key]!,
                  value,
                ] as const,
            );
            await update(manager, "vehicles", operation.vehicleId, fields);
            return (
              await this.vehicles(manager, userId, operation.vehicleId)
            )[0];
          }
          case "archive": {
            await this.ownerVehicle(
              manager,
              userId,
              operation.vehicleId,
              true,
              true,
            );
            await manager.query(
              "update public.vehicles set archived_at=case when $2 then now() else null end,updated_at=now() where id=$1",
              [operation.vehicleId, operation.archived],
            );
            return (
              await this.vehicles(manager, userId, operation.vehicleId)
            )[0];
          }
          case "createRecord": {
            await this.ownerVehicle(manager, userId, operation.vehicleId, true);
            const input = operation.input;
            const rows = await manager.query<{ id: string }[]>(
              "insert into public.vehicle_records(vehicle_id,kind,title,occurred_on,mileage_km,description,workshop_name) values($1,$2,$3,$4,$5,$6,$7) returning id",
              [
                operation.vehicleId,
                input.kind,
                input.title,
                input.occurredOn,
                input.mileageKm,
                input.description,
                input.workshopName,
              ],
            );
            return (
              await this.records(manager, userId, operation.vehicleId)
            ).find((record) => record.id === rows[0]!.id);
          }
          case "updateRecord": {
            await this.ownerVehicle(manager, userId, operation.vehicleId, true);
            await this.record(manager, operation.vehicleId, operation.recordId);
            const names: Record<string, string> = {
              kind: "kind",
              title: "title",
              occurredOn: "occurred_on",
              mileageKm: "mileage_km",
              description: "description",
              workshopName: "workshop_name",
            };
            await update(
              manager,
              "vehicle_records",
              operation.recordId,
              Object.entries(operation.input).map(
                ([key, value]) => [names[key]!, value] as const,
              ),
            );
            return (
              await this.records(manager, userId, operation.vehicleId)
            ).find((record) => record.id === operation.recordId);
          }
          case "deleteRecord": {
            await this.ownerVehicle(manager, userId, operation.vehicleId, true);
            await this.record(manager, operation.vehicleId, operation.recordId);
            // The service-managed document association is detached by a narrow RPC.
            await manager.query("select public.delete_garage_record($1,$2)", [
              operation.vehicleId,
              operation.recordId,
            ]);
            return { id: operation.recordId };
          }
          case "uploadDocument": {
            await this.ownerVehicle(manager, userId, operation.vehicleId, true);
            if (operation.recordId)
              await this.record(
                manager,
                operation.vehicleId,
                operation.recordId,
              );
            const id = randomUUID();
            const key = `documents/${id}`;
            await this.documentStorage().put(
              key,
              operation.file.bytes,
              operation.file.mimeType,
            );
            try {
              const rows = await manager.query<DocumentRow[]>(
                "insert into public.vehicle_documents(id,vehicle_id,owner_id,record_id,filename,mime_type,bytes,object_key) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
                [
                  id,
                  operation.vehicleId,
                  userId,
                  operation.recordId,
                  operation.file.filename,
                  operation.file.mimeType,
                  operation.file.bytes.byteLength,
                  key,
                ],
              );
              return documentDto(rows[0]!);
            } catch (error) {
              await this.documentStorage()
                .remove(key)
                .catch(() => undefined);
              throw error;
            }
          }
          case "attachDocument": {
            await this.ownerVehicle(manager, userId, operation.vehicleId, true);
            const original = sanitizeGarageDocumentFilename(
              operation.input.filename,
            );
            const filename = `${original.replace(/\.[^.]+$/u, "").slice(0, 250)}.webp`;
            const rows = await manager.query<{ id: string }[]>(
              "select public.attach_garage_image_document($1,$2,$3,$4) as id",
              [
                operation.vehicleId,
                operation.input.mediaId,
                operation.input.recordId,
                filename,
              ],
            );
            const documents = await this.documentRows(
              manager,
              userId,
              operation.vehicleId,
            );
            const document = documents.find((item) => item.id === rows[0]?.id);
            if (!document) throw garageFailure("GARAGE_UNAVAILABLE", 503);
            return documentDto(document);
          }
          case "downloadDocument": {
            const row = await this.document(
              manager,
              userId,
              operation.documentId,
              operation.vehicleId,
            );
            // Keep an ownership lock while reading, so accept cannot race authorization.
            return {
              filename: row.filename,
              mimeType: row.mime_type,
              bytes: await this.documentBytes(manager, userId, row),
            };
          }
          case "deleteDocument": {
            const row = await this.document(
              manager,
              userId,
              operation.documentId,
              operation.vehicleId,
            );
            // Retained documents remain removable by their owner after a transfer.
            const vehicles = await manager.query<
              { owner_id: string; archived_at: string | null }[]
            >(
              "select owner_id,archived_at from public.vehicles where id=$1 for update",
              [row.vehicle_id],
            );
            if (vehicles[0]?.owner_id === userId && vehicles[0].archived_at)
              throw garageFailure("GARAGE_ARCHIVED", 409);
            const pending = await manager.query<{ id: string }[]>(
              "select id from public.vehicle_transfers where vehicle_id=$1 and status='pending' and expires_at>now()",
              [row.vehicle_id],
            );
            if (pending[0]) throw garageFailure("GARAGE_TRANSFER_PENDING", 409);
            if (row.media_id) {
              const media = await manager.query<
                { id: string; owner_id: string; storage_provider: string }[]
              >(
                "select id,owner_id,storage_provider from public.media where id=$1 for update",
                [row.media_id],
              );
              if (!media[0] || media[0].owner_id !== userId)
                throw garageFailure("GARAGE_NOT_FOUND", 404);
              const objects = await manager.query<{ object_key: string }[]>(
                "select original_object_key as object_key from public.media where id=$1 and original_object_key is not null union select object_key from public.media_variants where media_id=$1",
                [row.media_id],
              );
              await manager.query(
                "update public.vehicle_documents set deleted_at=now(),record_id=null,media_id=null where id=$1 and owner_id=$2",
                [row.id, userId],
              );
              await manager.query(
                "delete from public.media where id=$1 and owner_id=$2",
                [row.media_id, userId],
              );
              if (objects.length)
                await manager.query(
                  "select public.enqueue_job('media_cleanup',$1::jsonb,0)",
                  [
                    JSON.stringify({
                      version: 1,
                      jobId: randomUUID(),
                      idempotencyKey: `document-delete:${row.id}`,
                      attempt: 0,
                      objects: objects.map((object) => ({
                        objectKey: object.object_key,
                        storageProvider: media[0]!.storage_provider,
                      })),
                    }),
                  ],
                );
            } else {
              if (!row.object_key) throw garageFailure("GARAGE_NOT_FOUND", 404);
              await this.documentStorage().remove(row.object_key);
              await manager.query(
                "update public.vehicle_documents set deleted_at=now(),record_id=null where id=$1 and owner_id=$2",
                [row.id, userId],
              );
            }
            return { id: row.id };
          }
          case "createTransfer": {
            const input = operation.input;
            const rows = await manager.query<{ id: string }[]>(
              "select public.create_vehicle_transfer($1,$2,$3::uuid[]) as id",
              [input.vehicleId, input.toUsername, [...input.documentIds]],
            );
            return (await this.transfers(manager, userId)).find(
              (transfer) => transfer.id === rows[0]!.id,
            );
          }
          case "decideTransfer": {
            await manager.query(
              "select public.decide_vehicle_transfer($1,$2)",
              [operation.transferId, operation.decision],
            );
            const transfer = (await this.transfers(manager, userId)).find(
              (item) => item.id === operation.transferId,
            );
            if (transfer?.status === "expired") return transfer;
            return transfer;
          }
        }
      },
    );
  }

  private documentStorage() {
    return (this.storage ??= createGarageDocumentStorage());
  }
  private async documentBytes(
    manager: EntityManager,
    userId: string,
    row: DocumentRow,
  ): Promise<Uint8Array> {
    if (!row.media_id) {
      if (!row.object_key || row.mime_type !== "application/pdf")
        throw garageFailure("GARAGE_NOT_FOUND", 404);
      return this.documentStorage().get(row.object_key);
    }
    const variants = await manager.query<
      {
        object_key: string;
        bytes: number;
        mime_type: string;
        storage_provider: string;
      }[]
    >(
      "select v.object_key,v.bytes,v.mime_type,m.storage_provider from public.media_variants v join public.media m on m.id=v.media_id where m.id=$1 and m.owner_id=$2 and m.purpose::text='vehicle_document' and m.status='ready' and m.deleted_at is null and v.kind='preview' for update of m",
      [row.media_id, userId],
    );
    const variant = variants[0];
    if (
      !variant ||
      variant.storage_provider !== "supabase" ||
      variant.mime_type !== "image/webp" ||
      Number(variant.bytes) !== Number(row.bytes)
    )
      throw garageFailure("GARAGE_NOT_FOUND", 404);
    const url = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !serviceRoleKey) throw garageFailure("GARAGE_UNAVAILABLE", 503);
    this.imageStorage ??= createSupabaseStorage({ url, serviceRoleKey });
    return this.imageStorage.get(variant.object_key);
  }
  private async ownerVehicle(
    manager: EntityManager,
    userId: string,
    id: string,
    write = false,
    allowArchived = false,
  ): Promise<VehicleRow> {
    const rows = await manager.query<VehicleRow[]>(
      `select * from public.vehicles where id=$1 and owner_id=$2 ${write ? "for update" : ""}`,
      [id, userId],
    );
    if (!rows[0]) throw garageFailure("GARAGE_NOT_FOUND", 404);
    if (write) {
      if (rows[0].archived_at && !allowArchived)
        throw garageFailure("GARAGE_ARCHIVED", 409);
      const pending = await manager.query<{ id: string }[]>(
        "select id from public.vehicle_transfers where vehicle_id=$1 and status='pending' and expires_at>now()",
        [id],
      );
      if (pending[0]) throw garageFailure("GARAGE_TRANSFER_PENDING", 409);
    }
    return rows[0];
  }
  private async vehicles(
    manager: EntityManager,
    userId: string,
    id?: string,
    canWrite = true,
  ): Promise<OwnerVehicleDto[]> {
    const rows = await manager.query<VehicleRow[]>(
      `select v.*,p.username,p.display_name from public.vehicles v join public.profiles p on p.id=v.owner_id where v.owner_id=$1 ${id ? "and v.id=$2" : ""} order by v.archived_at nulls first,v.created_at desc`,
      id ? [userId, id] : [userId],
    );
    const transfers = await this.transfers(manager, userId);
    const result: OwnerVehicleDto[] = [];
    for (const row of rows) {
      const links = await manager.query<{ media_id: string }[]>(
        "select media_id from public.vehicle_media where vehicle_id=$1 order by position",
        [row.id],
      );
      const count = await manager.query<{ count: string }[]>(
        "select count(*)::text as count from public.vehicle_records where vehicle_id=$1",
        [row.id],
      );
      const pendingTransfer =
        transfers.find(
          (t) => t.vehicleId === row.id && t.status === "pending",
        ) ?? null;
      result.push({
        id: row.id,
        owner: {
          id: row.owner_id,
          username: row.username,
          displayName: row.display_name,
        },
        kind: row.kind,
        brand: row.brand,
        model: row.model,
        year: row.year,
        nickname: row.nickname,
        description: row.description,
        visibility: row.visibility,
        mediaIds: links.map((link) => link.media_id),
        canEdit: canWrite && !row.archived_at && !pendingTransfer,
        mileageKm: row.mileage_km,
        nextServiceKm: row.next_service_km,
        nextServiceDate: date(row.next_service_date),
        archivedAt: iso(row.archived_at),
        recordCount: Number(count[0]?.count ?? 0),
        pendingTransfer,
        createdAt: iso(row.created_at)!,
        updatedAt: iso(row.updated_at)!,
      });
    }
    return result;
  }
  private async records(
    manager: EntityManager,
    userId: string,
    vehicleId?: string,
  ): Promise<VehicleRecordDto[]> {
    const rows = await manager.query<RecordRow[]>(
      `select r.*,coalesce(v.nickname,v.brand||' '||v.model) as vehicle_label from public.vehicle_records r join public.vehicles v on v.id=r.vehicle_id where v.owner_id=$1 ${vehicleId ? "and v.id=$2" : ""} order by r.occurred_on desc,r.created_at desc ${vehicleId ? "" : "limit 10"}`,
      vehicleId ? [userId, vehicleId] : [userId],
    );
    const documents = await this.documentRows(manager, userId, vehicleId);
    return rows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      vehicleLabel: row.vehicle_label,
      kind: row.kind,
      title: row.title,
      occurredOn: date(row.occurred_on)!,
      mileageKm: row.mileage_km,
      description: row.description,
      workshopName: row.workshop_name,
      documentIds: documents
        .filter((d) => d.record_id === row.id)
        .map((d) => d.id),
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    }));
  }
  private async record(manager: EntityManager, vehicleId: string, id: string) {
    const rows = await manager.query<{ id: string }[]>(
      "select id from public.vehicle_records where id=$1 and vehicle_id=$2",
      [id, vehicleId],
    );
    if (!rows[0]) throw garageFailure("GARAGE_NOT_FOUND", 404);
  }
  private documentRows(
    manager: EntityManager,
    userId: string,
    vehicleId?: string,
  ): Promise<DocumentRow[]> {
    return manager.query<DocumentRow[]>(
      `select * from public.vehicle_documents where owner_id=$1 and deleted_at is null ${vehicleId ? "and vehicle_id=$2" : ""} order by created_at desc`,
      vehicleId ? [userId, vehicleId] : [userId],
    );
  }
  private async document(
    manager: EntityManager,
    userId: string,
    id: string,
    vehicleId?: string,
  ): Promise<DocumentRow> {
    // A document lock is also held by transfer UPDATEs; post-lock rechecks use the
    // current owner, never a cached URL or the original uploader's path.
    const target = await manager.query<{ vehicle_id: string }[]>(
      "select vehicle_id from public.vehicle_documents where id=$1 and owner_id=$2 and deleted_at is null",
      [id, userId],
    );
    if (!target[0]) throw garageFailure("GARAGE_NOT_FOUND", 404);
    await manager.query(
      "select id from public.vehicles where id=$1 for update",
      [target[0].vehicle_id],
    );
    const rows = await manager.query<DocumentRow[]>(
      `select * from public.vehicle_documents where id=$1 and owner_id=$2 and deleted_at is null ${vehicleId ? "and vehicle_id=$3" : ""} for update`,
      vehicleId ? [id, userId, vehicleId] : [id, userId],
    );
    if (!rows[0]) throw garageFailure("GARAGE_NOT_FOUND", 404);
    return rows[0];
  }
  private async transfers(
    manager: EntityManager,
    userId: string,
  ): Promise<OwnershipTransferDto[]> {
    const rows = await manager.query<TransferRow[]>(
      "select * from public.vehicle_transfers where $1 in(from_id,to_id) order by created_at desc",
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      vehicleLabel: row.vehicle_label,
      fromUsername: row.from_username,
      toUsername: row.to_username,
      status:
        row.status === "pending" &&
        new Date(row.expires_at).getTime() <= Date.now()
          ? "expired"
          : row.status,
      expiresAt: iso(row.expires_at)!,
      documentIds: row.document_ids,
      createdAt: iso(row.created_at)!,
    }));
  }
  private async summary(
    manager: EntityManager,
    userId: string,
    canWrite = true,
  ): Promise<GarageSummaryDto> {
    const vehicles = await this.vehicles(manager, userId, undefined, canWrite);
    const ownedIds = new Set(vehicles.map((vehicle) => vehicle.id));
    const retainedDocuments = (await this.documentRows(manager, userId))
      .filter((document) => !ownedIds.has(document.vehicle_id))
      .map(documentDto);
    return {
      vehicles,
      recentRecords: await this.records(manager, userId),
      transfers: await this.transfers(manager, userId),
      retainedDocuments,
    };
  }
}
async function update(
  manager: EntityManager,
  table: "vehicles" | "vehicle_records",
  id: string,
  fields: Array<readonly [string, unknown]>,
) {
  if (!fields.length) return;
  await manager.query(
    `update public.${table} set ${fields.map(([column], i) => `${column}=$${i + 1}`).join(",")},updated_at=now() where id=$${fields.length + 1}`,
    [...fields.map(([, value]) => value), id],
  );
}
function iso(value: string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}
function date(value: string | Date | null): string | null {
  return value === null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
}
function documentDto(row: DocumentRow): VehicleDocumentDto {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    filename: row.filename,
    mimeType: row.mime_type,
    bytes: Number(row.bytes),
    recordId: row.record_id,
    createdAt: iso(row.created_at)!,
  };
}
