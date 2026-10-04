import { AuthenticationError, parseBearerToken } from "@iride/auth";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
  garageFailure,
  handleGarageRequest,
  type GarageDependencies,
  type GarageOperation,
} from "./garage";

const userId = "10000000-0000-4000-8000-000000000001";
const vehicleId = "20000000-0000-4000-8000-000000000001";
const recordId = "30000000-0000-4000-8000-000000000001";
const documentId = "40000000-0000-4000-8000-000000000001";
const transferId = "50000000-0000-4000-8000-000000000001";

it("reports expiry as a conflict after the repository persists the expired state", async () => {
  const dependencies = setup();
  vi.mocked(dependencies.repository.run).mockResolvedValue({
    id: transferId,
    status: "expired",
  });
  const response = await handleGarageRequest(
    request(`vehicle-transfers/${transferId}/accept`, "POST"),
    dependencies,
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    error: { code: "GARAGE_TRANSFER_EXPIRED" },
  });
});

function setup(): GarageDependencies {
  return {
    authenticate: vi.fn(async (request) => {
      parseBearerToken(request.headers.get("authorization"));
      return {
        userId,
        accessTokenClaims: {
          iss: "https://auth.test/auth/v1",
          sub: userId,
          aud: "authenticated",
          exp: 2_000_000_000,
          iat: 1_900_000_000,
          role: "authenticated",
          aal: "aal1",
          session_id: "60000000-0000-4000-8000-000000000001",
          is_anonymous: false,
        },
      };
    }),
    repository: { run: vi.fn().mockResolvedValue({ id: recordId }) },
    allowedOrigins: "https://app.test",
  };
}

function request(path: string, method = "GET", body?: unknown) {
  return new Request(`https://api.test/api/v1/${path}`, {
    method,
    headers: {
      authorization: "Bearer token",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function expectOperation(
  path: string,
  method: string,
  body: unknown,
  operation: GarageOperation,
  status = 200,
) {
  const deps = setup();
  const response = await handleGarageRequest(request(path, method, body), deps);
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ data: { id: recordId } });
  expect(deps.repository.run).toHaveBeenCalledWith(userId, operation);
}

const record = {
  kind: "service",
  title: "Oil change",
  occurredOn: "2026-10-01",
  mileageKm: 5000,
  description: null,
  workshopName: "Workshop",
} as const;

describe("garage request authorization and errors", () => {
  it("requires authentication before accessing private garage data", async () => {
    const deps = setup();
    const response = await handleGarageRequest(
      new Request("https://api.test/api/v1/profile/me/garage"),
      deps,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "AUTH_REQUIRED" },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(deps.repository.run).not.toHaveBeenCalled();
  });

  it("returns authentication provider failures without querying the repository", async () => {
    const deps = setup();
    vi.mocked(deps.authenticate).mockRejectedValue(
      new AuthenticationError("AUTH_PROVIDER_ERROR"),
    );
    const response = await handleGarageRequest(
      request("profile/me/garage"),
      deps,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "AUTH_PROVIDER_ERROR" },
    });
    expect(deps.repository.run).not.toHaveBeenCalled();
  });

  it("rejects an unapproved origin before authentication", async () => {
    const deps = setup();
    const input = request("profile/me/garage");
    input.headers.set("origin", "https://unapproved.test");
    const response = await handleGarageRequest(input, deps);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "CORS_ORIGIN_DENIED" },
    });
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
    expect(deps.authenticate).not.toHaveBeenCalled();
    expect(deps.repository.run).not.toHaveBeenCalled();
  });

  it("allows preflight requests for the configured origin without authentication", async () => {
    const deps = setup();
    const response = await handleGarageRequest(
      new Request("https://api.test/api/v1/profile/me/garage", {
        method: "OPTIONS",
        headers: { origin: "https://app.test" },
      }),
      deps,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://app.test",
    );
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "PATCH",
    );
    expect(deps.authenticate).not.toHaveBeenCalled();
  });

  it.each([
    "profile/me/garage/not-a-uuid",
    `vehicles/${vehicleId}/records/not-a-uuid`,
    "vehicle-documents/not-a-uuid",
  ])("rejects malformed identifiers in %s", async (path) => {
    const deps = setup();
    const response = await handleGarageRequest(
      request(path, path.includes("records") ? "DELETE" : "GET"),
      deps,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "GARAGE_VALIDATION_FAILED" },
    });
    expect(deps.repository.run).not.toHaveBeenCalled();
  });

  it("preserves a missing vehicle error from the repository", async () => {
    const deps = setup();
    vi.mocked(deps.repository.run).mockRejectedValue(
      garageFailure("GARAGE_NOT_FOUND", 404),
    );
    const response = await handleGarageRequest(
      request(`profile/me/garage/${vehicleId}`),
      deps,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "GARAGE_NOT_FOUND", message: "GARAGE_NOT_FOUND" },
    });
  });

  it("returns 405 for a method that the route does not support", async () => {
    const deps = setup();
    const response = await handleGarageRequest(
      request(`vehicles/${vehicleId}/records`, "PUT", record),
      deps,
    );
    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({
      error: { code: "GARAGE_METHOD_NOT_ALLOWED" },
    });
    expect(deps.repository.run).not.toHaveBeenCalled();
  });
});

describe("garage JSON route parsing", () => {
  it.each([
    ["profile/me/garage", "garage"],
    ["profile/me/garage-summary", "summary"],
    ["vehicle-transfers", "transfers"],
  ] as const)("reads %s for the authenticated owner", async (path, kind) => {
    await expectOperation(path, "GET", undefined, { kind });
  });

  it("lists records for a vehicle", async () => {
    await expectOperation(`vehicles/${vehicleId}/records`, "GET", undefined, {
      kind: "records",
      vehicleId,
    });
  });

  it("creates a record with validated and trimmed input", async () => {
    await expectOperation(
      `vehicles/${vehicleId}/records`,
      "POST",
      { ...record, title: "  Oil change  " },
      {
        kind: "createRecord",
        vehicleId,
        input: record,
      },
      201,
    );
  });

  it("updates only the submitted record fields", async () => {
    await expectOperation(
      `vehicles/${vehicleId}/records/${recordId}`,
      "PATCH",
      { mileageKm: 6000 },
      {
        kind: "updateRecord",
        vehicleId,
        recordId,
        input: { mileageKm: 6000 },
      },
    );
  });

  it("deletes the specified vehicle record", async () => {
    await expectOperation(
      `vehicles/${vehicleId}/records/${recordId}`,
      "DELETE",
      undefined,
      {
        kind: "deleteRecord",
        vehicleId,
        recordId,
      },
    );
  });

  it("updates vehicle service reminders", async () => {
    await expectOperation(
      `profile/me/garage/${vehicleId}`,
      "PATCH",
      { nextServiceKm: 10000, nextServiceDate: null },
      {
        kind: "updateVehicle",
        vehicleId,
        input: { nextServiceKm: 10000, nextServiceDate: null },
      },
    );
  });

  it.each([
    [`profile/me/garage/${vehicleId}`, {}],
    [`profile/me/garage/${vehicleId}`, { unexpected: true }],
    [`vehicles/${vehicleId}/records/${recordId}`, {}],
    [
      `vehicles/${vehicleId}/records/${recordId}`,
      { title: "Valid title", unexpected: true },
    ],
  ])("rejects empty or unknown patch fields %#", async (path, body) => {
    const deps = setup();
    const response = await handleGarageRequest(
      request(path as string, "PATCH", body),
      deps,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "GARAGE_VALIDATION_FAILED" },
    });
    expect(deps.repository.run).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "parses archived=%s as a boolean",
    async (archived) => {
      await expectOperation(
        `vehicles/${vehicleId}/archive`,
        "POST",
        { archived },
        { kind: "archive", vehicleId, archived },
      );
    },
  );

  it("rejects a string archive flag", async () => {
    const deps = setup();
    const response = await handleGarageRequest(
      request(`vehicles/${vehicleId}/archive`, "POST", { archived: "false" }),
      deps,
    );
    expect(response.status).toBe(400);
    expect(deps.repository.run).not.toHaveBeenCalled();
  });

  it("normalizes the transfer recipient and preserves selected document IDs", async () => {
    await expectOperation(
      "vehicle-transfers",
      "POST",
      { vehicleId, toUsername: "  New_Rider  ", documentIds: [documentId] },
      {
        kind: "createTransfer",
        input: {
          vehicleId,
          toUsername: "new_rider",
          documentIds: [documentId],
        },
      },
      201,
    );
  });

  it("defaults a transfer's document selection to empty", async () => {
    await expectOperation(
      "vehicle-transfers",
      "POST",
      { vehicleId, toUsername: "new_rider" },
      {
        kind: "createTransfer",
        input: { vehicleId, toUsername: "new_rider", documentIds: [] },
      },
      201,
    );
  });

  it.each([
    { documentIds: [documentId, documentId] },
    { documentIds: ["not-a-uuid"] },
  ])(
    "rejects invalid transfer document selections %#",
    async ({ documentIds }) => {
      const deps = setup();
      const response = await handleGarageRequest(
        request("vehicle-transfers", "POST", {
          vehicleId,
          toUsername: "new_rider",
          documentIds,
        }),
        deps,
      );
      expect(response.status).toBe(400);
      expect(deps.repository.run).not.toHaveBeenCalled();
    },
  );

  it.each(["accept", "reject", "cancel"] as const)(
    "parses the %s transfer decision",
    async (decision) => {
      await expectOperation(
        `vehicle-transfers/${transferId}/${decision}`,
        "POST",
        undefined,
        { kind: "decideTransfer", transferId, decision },
      );
    },
  );
});

describe("garage document responses", () => {
  it.each([
    [
      `vehicles/${vehicleId}/documents/${documentId}`,
      { kind: "downloadDocument", vehicleId, documentId },
    ],
    [
      `vehicle-documents/${documentId}`,
      { kind: "downloadDocument", documentId },
    ],
  ] as const)(
    "streams private document bytes from %s as an attachment",
    async (path, operation) => {
      const deps = setup();
      const bytes = new Uint8Array([1, 2, 3, 4]);
      vi.mocked(deps.repository.run).mockResolvedValue({
        filename: "ใบเสร็จ garage.pdf",
        mimeType: "application/pdf",
        bytes,
      });
      const response = await handleGarageRequest(request(path), deps);
      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("content-disposition")).toBe(
        "attachment; filename*=UTF-8''%E0%B9%83%E0%B8%9A%E0%B9%80%E0%B8%AA%E0%B8%A3%E0%B9%87%E0%B8%88%20garage.pdf",
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.has("location")).toBe(false);
      expect(deps.repository.run).toHaveBeenCalledWith(userId, operation);
    },
  );

  it("requires document PNG images to use the existing signed-upload pipeline", async () => {
    const deps = setup();
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array(bytes)], "receipt.png", { type: "image/png" }),
    );
    form.set("recordId", recordId);
    const response = await handleGarageRequest(
      new Request(`https://api.test/api/v1/vehicles/${vehicleId}/documents`, {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: form,
      }),
      deps,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "GARAGE_DOCUMENT_IMAGE_PIPELINE_REQUIRED" },
    });
    expect(deps.repository.run).not.toHaveBeenCalled();
  });

  it("attaches a ready image media reference through JSON", async () => {
    await expectOperation(
      `vehicles/${vehicleId}/documents`,
      "POST",
      { mediaId: documentId, filename: "receipt.jpg" },
      {
        kind: "attachDocument",
        vehicleId,
        input: { mediaId: documentId, filename: "receipt.jpg", recordId: null },
      },
      201,
    );
  });
  it("retains the dedicated multipart PDF path", async () => {
    const dependencies = setup();
    const body = "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n";
    const bytes = Buffer.from(
      `${body}xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n${Buffer.byteLength(body)}\n%%EOF\n`,
    );
    const form = new FormData();
    form.set(
      "file",
      new File([bytes], "receipt.pdf", { type: "application/pdf" }),
    );
    form.set("recordId", recordId);
    const response = await handleGarageRequest(
      new Request(`https://api.test/api/v1/vehicles/${vehicleId}/documents`, {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: form,
      }),
      dependencies,
    );
    expect(response.status).toBe(201);
    expect(dependencies.repository.run).toHaveBeenCalledWith(userId, {
      kind: "uploadDocument",
      vehicleId,
      recordId,
      file: {
        filename: "receipt.pdf",
        mimeType: "application/pdf",
        bytes: new Uint8Array(bytes),
      },
    });
  });

  it.each(["fake-pdf", "mime-mismatch"])(
    "rejects %s before creating document metadata",
    async (kind) => {
      const deps = setup();
      const bytes =
        kind === "fake-pdf"
          ? Buffer.from("%PDF-1.7\n%%EOF")
          : await sharp({
              create: { width: 2, height: 2, channels: 3, background: "red" },
            })
              .png()
              .toBuffer();
      const form = new FormData();
      form.set(
        "file",
        new File([new Uint8Array(bytes)], "receipt.pdf", {
          type: "application/pdf",
        }),
      );
      const response = await handleGarageRequest(
        new Request(`https://api.test/api/v1/vehicles/${vehicleId}/documents`, {
          method: "POST",
          headers: { authorization: "Bearer token" },
          body: form,
        }),
        deps,
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { code: "GARAGE_DOCUMENT_INVALID" },
      });
      expect(deps.repository.run).not.toHaveBeenCalled();
    },
  );
});
