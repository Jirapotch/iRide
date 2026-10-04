import {
  AuthenticationError,
  toAuthErrorBody,
  type AuthContext,
} from "@iride/auth";
import {
  archiveVehicleSchema,
  attachVehicleDocumentSchema,
  createOwnershipTransferSchema,
  garageIdSchema,
  updateGarageVehicleSchema,
  updateVehicleRecordSchema,
  vehicleRecordSchema,
} from "@iride/validation";
import type {
  CreateOwnershipTransferInput,
  AttachVehicleDocumentInput,
  UpdateGarageVehicleInput,
  VehicleRecordInput,
} from "@iride/types";
import { createCorsDecision } from "./cors";
import { validateGarageDocument } from "./garage-document-storage";

export type GarageOperation =
  | { kind: "garage" | "summary" | "transfers" }
  | { kind: "vehicle" | "records" | "documents"; vehicleId: string }
  | {
      kind: "updateVehicle";
      vehicleId: string;
      input: UpdateGarageVehicleInput;
    }
  | { kind: "archive"; vehicleId: string; archived: boolean }
  | { kind: "createRecord"; vehicleId: string; input: VehicleRecordInput }
  | {
      kind: "updateRecord";
      vehicleId: string;
      recordId: string;
      input: Partial<VehicleRecordInput>;
    }
  | { kind: "deleteRecord"; vehicleId: string; recordId: string }
  | {
      kind: "uploadDocument";
      vehicleId: string;
      recordId: string | null;
      file: { filename: string; mimeType: string; bytes: Uint8Array };
    }
  | {
      kind: "attachDocument";
      vehicleId: string;
      input: AttachVehicleDocumentInput;
    }
  | {
      kind: "downloadDocument" | "deleteDocument";
      documentId: string;
      vehicleId?: string;
    }
  | { kind: "createTransfer"; input: CreateOwnershipTransferInput }
  | {
      kind: "decideTransfer";
      transferId: string;
      decision: "accept" | "reject" | "cancel";
    };
export interface GarageRepository {
  run(userId: string, operation: GarageOperation): Promise<unknown>;
}
export interface GarageDependencies {
  authenticate(request: Pick<Request, "headers">): Promise<AuthContext>;
  repository: GarageRepository;
  allowedOrigins?: string;
}
export function garageFailure(code: string, status: number) {
  return Object.assign(new Error(code), { code, status });
}

export async function handleGarageRequest(
  request: Request,
  dependencies: GarageDependencies,
): Promise<Response> {
  const cors = createCorsDecision(
    request,
    dependencies.allowedOrigins,
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  cors.headers.set("Cache-Control", "private, no-store");
  if (!cors.allowed)
    return Response.json(
      { error: { code: "CORS_ORIGIN_DENIED" } },
      { status: 403, headers: cors.headers },
    );
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors.headers });
  try {
    const actor = await dependencies.authenticate(request);
    const operation = await parseGarageOperation(request);
    const data = await dependencies.repository.run(actor.userId, operation);
    if (
      operation.kind === "decideTransfer" &&
      (data as { status?: string } | undefined)?.status === "expired"
    )
      throw garageFailure("GARAGE_TRANSFER_EXPIRED", 409);
    if (operation.kind === "downloadDocument") {
      const document = data as {
        filename: string;
        mimeType: string;
        bytes: Uint8Array;
      };
      cors.headers.set("Content-Type", document.mimeType);
      cors.headers.set(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
      );
      cors.headers.set("X-Content-Type-Options", "nosniff");
      return new Response(new Uint8Array(document.bytes), {
        headers: cors.headers,
      });
    }
    return Response.json(
      { data },
      {
        headers: cors.headers,
        status:
          operation.kind === "createRecord" ||
          operation.kind === "uploadDocument" ||
          operation.kind === "attachDocument" ||
          operation.kind === "createTransfer"
            ? 201
            : 200,
      },
    );
  } catch (error) {
    if (error instanceof AuthenticationError)
      return Response.json(toAuthErrorBody(error), {
        status: error.status,
        headers: cors.headers,
      });
    const failure = error as {
      code?: string;
      status?: number;
      message?: string;
    };
    const databaseCode = failure.code;
    const code = failure.status
      ? (failure.code ?? "GARAGE_UNAVAILABLE")
      : databaseCode === "42501"
        ? "GARAGE_FORBIDDEN"
        : databaseCode === "55000"
          ? (failure.message ?? "GARAGE_CONFLICT")
          : databaseCode === "23505"
            ? "GARAGE_TRANSFER_PENDING"
            : databaseCode === "22023"
              ? (failure.message ?? "GARAGE_VALIDATION_FAILED")
              : "GARAGE_UNAVAILABLE";
    const status =
      failure.status ??
      (databaseCode === "42501"
        ? 403
        : databaseCode === "55000" || databaseCode === "23505"
          ? 409
          : databaseCode === "22023"
            ? 400
            : 503);
    return Response.json(
      { error: { code, message: code } },
      { status, headers: cors.headers },
    );
  }
}
async function parseGarageOperation(
  request: Request,
): Promise<GarageOperation> {
  const path = new URL(request.url).pathname.replace(/^\/api\/v1\//, "");
  const method = request.method;
  if (method === "GET" && path === "profile/me/garage")
    return { kind: "garage" };
  if (method === "GET" && path === "profile/me/garage-summary")
    return { kind: "summary" };
  let match = /^profile\/me\/garage\/([^/]+)$/.exec(path);
  if (match) {
    const vehicleId = uuid(match[1]);
    if (method === "GET") return { kind: "vehicle", vehicleId };
    if (method === "PATCH")
      return {
        kind: "updateVehicle",
        vehicleId,
        input: (await json(
          request,
          updateGarageVehicleSchema,
        )) as UpdateGarageVehicleInput,
      };
  }
  match = /^vehicles\/([^/]+)\/archive$/.exec(path);
  if (match && method === "POST")
    return {
      kind: "archive",
      vehicleId: uuid(match[1]),
      ...(await json(request, archiveVehicleSchema)),
    };
  match = /^vehicles\/([^/]+)\/records(?:\/([^/]+))?$/.exec(path);
  if (match) {
    const vehicleId = uuid(match[1]);
    if (!match[2] && method === "GET") return { kind: "records", vehicleId };
    if (!match[2] && method === "POST")
      return {
        kind: "createRecord",
        vehicleId,
        input: await json(request, vehicleRecordSchema),
      };
    if (match[2] && method === "PATCH")
      return {
        kind: "updateRecord",
        vehicleId,
        recordId: uuid(match[2]),
        input: (await json(
          request,
          updateVehicleRecordSchema,
        )) as Partial<VehicleRecordInput>,
      };
    if (match[2] && method === "DELETE")
      return { kind: "deleteRecord", vehicleId, recordId: uuid(match[2]) };
  }
  match = /^vehicles\/([^/]+)\/documents(?:\/([^/]+))?$/.exec(path);
  if (match) {
    const vehicleId = uuid(match[1]);
    if (!match[2] && method === "GET") return { kind: "documents", vehicleId };
    if (!match[2] && method === "POST") {
      if (request.headers.get("content-type")?.startsWith("application/json"))
        return {
          kind: "attachDocument",
          vehicleId,
          input: await json(request, attachVehicleDocumentSchema),
        };
      const length = Number(request.headers.get("content-length") ?? 0);
      if (length > 11 * 1024 * 1024)
        throw garageFailure("GARAGE_DOCUMENT_TOO_LARGE", 413);
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        throw garageFailure("GARAGE_DOCUMENT_INVALID", 400);
      }
      const file = form.get("file");
      if (!(file instanceof File))
        throw garageFailure("GARAGE_DOCUMENT_INVALID", 400);
      if (file.type !== "application/pdf")
        throw garageFailure("GARAGE_DOCUMENT_IMAGE_PIPELINE_REQUIRED", 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const verified = await validateGarageDocument(
        bytes,
        file.type,
        file.name,
      );
      const record = form.get("recordId");
      return {
        kind: "uploadDocument",
        vehicleId,
        recordId: typeof record === "string" && record ? uuid(record) : null,
        file: {
          filename: verified.filename,
          mimeType: verified.mimeType,
          bytes,
        },
      };
    }
    if (match[2] && (method === "GET" || method === "DELETE"))
      return {
        kind: method === "GET" ? "downloadDocument" : "deleteDocument",
        vehicleId,
        documentId: uuid(match[2]),
      };
  }
  match = /^vehicle-documents\/([^/]+)$/.exec(path);
  if (match && (method === "GET" || method === "DELETE"))
    return {
      kind: method === "GET" ? "downloadDocument" : "deleteDocument",
      documentId: uuid(match[1]),
    };
  if (path === "vehicle-transfers") {
    if (method === "GET") return { kind: "transfers" };
    if (method === "POST")
      return {
        kind: "createTransfer",
        input: await json(request, createOwnershipTransferSchema),
      };
  }
  match = /^vehicle-transfers\/([^/]+)\/(accept|reject|cancel)$/.exec(path);
  if (match && method === "POST")
    return {
      kind: "decideTransfer",
      transferId: uuid(match[1]),
      decision: match[2] as "accept" | "reject" | "cancel",
    };
  throw garageFailure("GARAGE_METHOD_NOT_ALLOWED", 405);
}
function uuid(value: unknown) {
  const result = garageIdSchema.safeParse(value);
  if (!result.success) throw garageFailure("GARAGE_VALIDATION_FAILED", 400);
  return result.data;
}
async function json<T>(
  request: Request,
  schema: {
    safeParse(input: unknown): { success: true; data: T } | { success: false };
  },
): Promise<T> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw garageFailure("GARAGE_VALIDATION_FAILED", 400);
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw garageFailure("GARAGE_VALIDATION_FAILED", 400);
  return parsed.data;
}
