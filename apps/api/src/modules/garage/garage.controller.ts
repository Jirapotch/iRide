import { authenticateRequest } from "@iride/auth";
import { getApiEnv } from "@iride/config/api";
import { All, Controller, Req, Res } from "@nestjs/common";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import {
  sendWebResponse,
  toWebRequest,
} from "../../common/http/web-handler.adapter";
import { garageFailure, handleGarageRequest } from "../../lib/garage";
import { TypeOrmGarageRepository } from "./typeorm-garage.repository";

@Controller("api/v1")
export class GarageController {
  constructor(private readonly repository: TypeOrmGarageRepository) {}
  @All([
    "profile/me/garage",
    "profile/me/garage-summary",
    "profile/me/garage/:vehicleId",
    "vehicles/:vehicleId/records",
    "vehicles/:vehicleId/records/:recordId",
    "vehicles/:vehicleId/documents",
    "vehicles/:vehicleId/documents/:documentId",
    "vehicles/:vehicleId/archive",
    "vehicle-documents/:documentId",
    "vehicle-transfers",
    "vehicle-transfers/:transferId/:decision",
  ])
  async handle(
    @Req() request: ExpressRequest,
    @Res() response: ExpressResponse,
  ): Promise<void> {
    if (request.method === "POST" && request.is("multipart/form-data")) {
      try {
        request.body = await readGarageMultipartBody(request);
      } catch (error) {
        const failure = error as { status?: number; code?: string };
        response
          .status(failure.status ?? 400)
          .json({ error: { code: failure.code ?? "GARAGE_DOCUMENT_INVALID" } });
        return;
      }
    }
    const env = getApiEnv();
    await sendWebResponse(
      response,
      await handleGarageRequest(toWebRequest(request), {
        authenticate: (input) =>
          authenticateRequest(input, {
            supabaseUrl: env.SUPABASE_URL,
            publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
          }),
        repository: this.repository,
        allowedOrigins: env.CORS_ALLOWED_ORIGINS,
      }),
    );
  }
}

export function readGarageMultipartBody(
  request: ExpressRequest,
  maxBytes = 11 * 1024 * 1024,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = Number(request.headers["content-length"] ?? 0) > maxBytes;
    const data = (chunk: Uint8Array) => {
      size += chunk.byteLength;
      if (size > maxBytes) {
        chunks.length = 0;
        tooLarge = true;
      }
      // Drain over-limit requests with bounded memory before responding. Early
      // response on a closing HTTP connection can reset an uploading client.
      if (tooLarge) return;
      chunks.push(Buffer.from(chunk));
    };
    request.on("data", data);
    request.once("end", () =>
      tooLarge
        ? reject(garageFailure("GARAGE_DOCUMENT_TOO_LARGE", 413))
        : resolve(Buffer.concat(chunks)),
    );
    request.once("error", () =>
      reject(garageFailure("GARAGE_DOCUMENT_INVALID", 400)),
    );
    request.once("aborted", () =>
      reject(garageFailure("GARAGE_DOCUMENT_INVALID", 400)),
    );
  });
}
