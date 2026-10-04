import sharp from "sharp";

export const GARAGE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export interface GarageDocumentStorage {
  put: (key: string, bytes: Uint8Array, mime: string) => Promise<void>;
  get: (key: string) => Promise<Uint8Array>;
  remove: (key: string) => Promise<void>;
}

export class GarageDocumentError extends Error {
  constructor(
    readonly code: "GARAGE_DOCUMENT_INVALID" | "GARAGE_UNAVAILABLE",
    readonly status: 400 | 413 | 503,
  ) {
    super(code);
  }
}

export async function validateGarageDocument(
  bytes: Uint8Array,
  claimedMime: string,
  filename: string,
): Promise<{ filename: string; mimeType: string; bytes: number }> {
  if (bytes.byteLength > GARAGE_DOCUMENT_MAX_BYTES)
    throw new GarageDocumentError("GARAGE_DOCUMENT_INVALID", 413);
  const mimeType = claimedMime.trim().toLowerCase();
  const sanitizedFilename = sanitizeGarageDocumentFilename(filename);
  if (
    bytes.byteLength === 0 ||
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      mimeType,
    )
  )
    invalid();

  if (mimeType === "application/pdf") {
    // No PDF parser is installed. Check the PDF envelope and the final cross
    // reference target; this is format validation, not a PDF security scan.
    const source = Buffer.from(bytes).toString("latin1");
    const trailer = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(source);
    if (!/^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n)/.test(source) || !trailer) invalid();
    const offset = Number(trailer![1]);
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset >= bytes.byteLength ||
      !/^(?:xref\b|\d+\s+\d+\s+obj\b)/.test(source.slice(offset))
    )
      invalid();
  } else {
    try {
      const image = sharp(bytes, {
        failOn: "warning",
        limitInputPixels: 40_000_000,
      });
      const metadata = await image.metadata();
      const expectedFormat = {
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
      }[mimeType];
      if (
        metadata.format !== expectedFormat ||
        !metadata.width ||
        !metadata.height
      )
        invalid();
      await image.resize(1, 1).toBuffer();
    } catch {
      invalid();
    }
  }
  return { filename: sanitizedFilename, mimeType, bytes: bytes.byteLength };
}

export function sanitizeGarageDocumentFilename(filename: string): string {
  const sanitizedFilename = filename
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)!
    .normalize("NFC")
    .replace(/[\p{Cc}<>:"|?*]/gu, "_")
    .trim()
    .replace(/[. ]+$/, "");
  if (!sanitizedFilename || sanitizedFilename.length > 255) invalid();

  return sanitizedFilename;
}

export function createGarageDocumentStorage(
  config: {
    readonly url?: string;
    readonly serviceRoleKey?: string;
    readonly fetch?: typeof fetch;
  } = {},
): GarageDocumentStorage {
  const url = (config.url ?? process.env.SUPABASE_URL)
    ?.trim()
    .replace(/\/+$/, "");
  const serviceRoleKey = (
    config.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
  const fetcher = config.fetch ?? fetch;
  const bucket = "garage-documents";

  async function request(path: string, init: RequestInit) {
    if (!url || !serviceRoleKey) unavailable();
    try {
      const headers = new Headers(init.headers);
      headers.set("apikey", serviceRoleKey!);
      headers.set("Authorization", `Bearer ${serviceRoleKey}`);
      const response = await fetcher(`${url}/storage/v1/${path}`, {
        ...init,
        headers,
        redirect: "error",
      });
      if (!response.ok) unavailable();
      return response;
    } catch {
      // Provider responses can contain privileged storage details. Expose only
      // the application error; credentials and raw failures stay server side.
      unavailable();
    }
  }

  return {
    async put(key, bytes, mime) {
      const path = objectPath(key);
      const document = await validateGarageDocument(
        bytes,
        mime,
        key.split("/").at(-1)!,
      );
      await request(`object/${bucket}/${path}`, {
        method: "POST",
        headers: { "Content-Type": document.mimeType, "x-upsert": "false" },
        body: new Uint8Array(bytes),
      });
    },
    async get(key) {
      const response = await request(
        `object/authenticated/${bucket}/${objectPath(key)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      try {
        return new Uint8Array(await response.arrayBuffer());
      } catch {
        unavailable();
      }
    },
    async remove(key) {
      objectPath(key);
      await request(`object/${bucket}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [key] }),
      });
    },
  };
}

function objectPath(key: string) {
  const segments = key.split("/");
  if (
    /[\p{Cc}\\]/u.test(key) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  )
    invalid();
  return segments.map(encodeURIComponent).join("/");
}

function invalid(): never {
  throw new GarageDocumentError("GARAGE_DOCUMENT_INVALID", 400);
}

function unavailable(): never {
  throw new GarageDocumentError("GARAGE_UNAVAILABLE", 503);
}
