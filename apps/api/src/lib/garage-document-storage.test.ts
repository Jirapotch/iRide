import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGarageDocumentStorage,
  validateGarageDocument,
} from "./garage-document-storage";

function pdf() {
  const body =
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n";
  return Buffer.from(
    `${body}xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000061 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n${Buffer.byteLength(body)}\n%%EOF\n`,
  );
}

const invalid = { code: "GARAGE_DOCUMENT_INVALID", status: 400 };

afterEach(() => vi.unstubAllEnvs());

describe("garage document validation", () => {
  it.each([
    ["jpeg", "image/jpeg", "photo.jpg"],
    ["png", "image/png", "photo.png"],
    ["webp", "image/webp", "photo.webp"],
  ] as const)("accepts decoded %s bytes", async (format, mime, filename) => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .toFormat(format)
      .toBuffer();
    await expect(
      validateGarageDocument(bytes, mime, filename),
    ).resolves.toEqual({
      filename,
      mimeType: mime,
      bytes: bytes.length,
    });
  });

  it("accepts a PDF and sanitizes its basename", async () => {
    const bytes = pdf();
    await expect(
      validateGarageDocument(
        bytes,
        "application/pdf",
        'C:\\fakepath\\receipt\r\n".pdf',
      ),
    ).resolves.toEqual({
      filename: "receipt___.pdf",
      mimeType: "application/pdf",
      bytes: bytes.length,
    });
  });

  it("rejects an image declared as a different MIME type", async () => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(
      validateGarageDocument(bytes, "image/jpeg", "photo.jpg"),
    ).rejects.toMatchObject(invalid);
    await expect(
      validateGarageDocument(bytes, "application/pdf", "receipt.pdf"),
    ).rejects.toMatchObject(invalid);
  });

  it.each([
    [Buffer.from("not an image"), "image/png"],
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml"],
    [Buffer.from("%PDF-1.7\n%%EOF"), "application/pdf"],
    [pdf().subarray(0, pdf().length - 7), "application/pdf"],
    [new Uint8Array(), "image/png"],
  ])("rejects unsupported or malformed bytes %#", async (bytes, mime) => {
    await expect(
      validateGarageDocument(bytes, mime, "document"),
    ).rejects.toMatchObject(invalid);
  });

  it("rejects documents larger than 10 MiB before inspecting bytes", async () => {
    await expect(
      validateGarageDocument(
        new Uint8Array(10 * 1024 * 1024 + 1),
        "application/pdf",
        "receipt.pdf",
      ),
    ).rejects.toMatchObject({ code: "GARAGE_DOCUMENT_INVALID", status: 413 });
  });

  it("allows a PDF at the 10 MiB boundary", async () => {
    const bytes = Buffer.concat([
      pdf().subarray(0, -6),
      Buffer.alloc(10 * 1024 * 1024 - pdf().length, 32),
      Buffer.from("%%EOF\n"),
    ]);
    await expect(
      validateGarageDocument(bytes, "application/pdf", "receipt.pdf"),
    ).resolves.toMatchObject({ bytes: 10 * 1024 * 1024 });
  });

  it.each(["", "..", "a".repeat(256)])(
    "rejects unusable filenames %#",
    async (filename) => {
      await expect(
        validateGarageDocument(pdf(), "application/pdf", filename),
      ).rejects.toMatchObject(invalid);
    },
  );
});

describe("private garage document storage", () => {
  it("uploads, reads bytes, and removes through the dedicated authenticated bucket", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const bytes = pdf();
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      calls.push({ url: String(input), init });
      return init?.method === "GET" ? new Response(bytes) : Response.json({});
    });
    const storage = createGarageDocumentStorage({
      url: "https://storage.test/",
      serviceRoleKey: "server-key",
      fetch: fetcher,
    });
    await storage.put("users/owner/receipt #1.pdf", bytes, "application/pdf");
    expect(await storage.get("users/owner/receipt #1.pdf")).toEqual(
      new Uint8Array(bytes),
    );
    await storage.remove("users/owner/receipt #1.pdf");
    expect(calls.map((call) => [call.url, call.init?.method])).toEqual([
      [
        "https://storage.test/storage/v1/object/garage-documents/users/owner/receipt%20%231.pdf",
        "POST",
      ],
      [
        "https://storage.test/storage/v1/object/authenticated/garage-documents/users/owner/receipt%20%231.pdf",
        "GET",
      ],
      ["https://storage.test/storage/v1/object/garage-documents", "DELETE"],
    ]);
    expect(new Headers(calls[0]?.init?.headers).get("Authorization")).toBe(
      "Bearer server-key",
    );
    expect(new Headers(calls[0]?.init?.headers).get("x-upsert")).toBe("false");
    expect(calls[2]?.init?.body).toBe(
      JSON.stringify({ prefixes: ["users/owner/receipt #1.pdf"] }),
    );
  });

  it("reads environment configuration by default", async () => {
    vi.stubEnv("SUPABASE_URL", "https://storage.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-key");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}));
    const storage = createGarageDocumentStorage({ fetch: fetcher });
    await storage.remove("owner/document.pdf");
    expect(fetcher).toHaveBeenCalledWith(
      "https://storage.test/storage/v1/object/garage-documents",
      expect.anything(),
    );
  });

  it("maps missing configuration and storage failures to unavailable errors", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(
      createGarageDocumentStorage().get("owner/document.pdf"),
    ).rejects.toMatchObject({ code: "GARAGE_UNAVAILABLE", status: 503 });
    const storage = createGarageDocumentStorage({
      url: "https://storage.test",
      serviceRoleKey: "server-key",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("private provider details", { status: 500 }),
        ),
    });
    await expect(
      storage.put("owner/document.pdf", pdf(), "application/pdf"),
    ).rejects.toMatchObject({ code: "GARAGE_UNAVAILABLE", status: 503 });
  });

  it.each([
    "../document.pdf",
    "users/../document.pdf",
    "/document.pdf",
    "document\\name.pdf",
  ])("rejects unsafe object key %s before contacting storage", async (key) => {
    const fetcher = vi.fn<typeof fetch>();
    const storage = createGarageDocumentStorage({
      url: "https://storage.test",
      serviceRoleKey: "server-key",
      fetch: fetcher,
    });
    await expect(storage.get(key)).rejects.toMatchObject(invalid);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
