import { describe, expect, it } from "vitest";
import {
  archiveVehicleSchema,
  attachVehicleDocumentSchema,
  mediaUploadRequestSchema,
  createOwnershipTransferSchema,
  updateGarageVehicleSchema,
  updateVehicleRecordSchema,
  vehicleRecordSchema,
} from "./index";
const record = {
  kind: "service",
  title: "Oil change",
  occurredOn: "2026-10-04",
  mileageKm: 12000,
  description: null,
  workshopName: null,
};
const id = "10000000-0000-4000-8000-000000000001";
describe("digital garage validation", () => {
  it("requires a vehicle context exclusively for private document-image uploads", () => {
    const image = {
      filename: "receipt.png",
      mimeType: "image/png",
      bytes: 100,
      purpose: "vehicle_document",
    };
    expect(mediaUploadRequestSchema.safeParse(image).success).toBe(false);
    expect(
      mediaUploadRequestSchema.safeParse({ ...image, vehicleId: id }).success,
    ).toBe(true);
    expect(
      mediaUploadRequestSchema.safeParse({
        ...image,
        purpose: "vehicle",
        vehicleId: id,
      }).success,
    ).toBe(false);
  });
  it("requires ready media references and never accepts object keys for document attachment", () => {
    expect(
      attachVehicleDocumentSchema.parse({
        mediaId: id,
        filename: "receipt.jpg",
      }),
    ).toEqual({ mediaId: id, filename: "receipt.jpg", recordId: null });
    expect(
      attachVehicleDocumentSchema.safeParse({
        mediaId: id,
        filename: "receipt.jpg",
        objectKey: "someone-else",
      }).success,
    ).toBe(false);
  });
  it("accepts service and modification history with optional nullable details", () => {
    expect(vehicleRecordSchema.safeParse(record).success).toBe(true);
    expect(
      vehicleRecordSchema.safeParse({
        ...record,
        kind: "modification",
        mileageKm: null,
      }).success,
    ).toBe(true);
  });
  it.each([
    { occurredOn: "2026-02-30" },
    { mileageKm: -1 },
    { mileageKm: 1.5 },
    { title: " " },
    { kind: "verified" },
    { description: "x".repeat(4001) },
    { workshopName: "x".repeat(121) },
    { ownerId: id },
  ])("rejects invalid or privileged history input %j", (patch) =>
    expect(vehicleRecordSchema.safeParse({ ...record, ...patch }).success).toBe(
      false,
    ),
  );
  it("rejects empty and unknown patches", () => {
    expect(updateVehicleRecordSchema.safeParse({}).success).toBe(false);
    expect(updateGarageVehicleSchema.safeParse({}).success).toBe(false);
    expect(updateGarageVehicleSchema.safeParse({ ownerId: id }).success).toBe(
      false,
    );
    expect(
      updateGarageVehicleSchema.safeParse({
        nextServiceDate: null,
        mileageKm: 0,
      }).success,
    ).toBe(true);
  });
  it("normalizes the named recipient and defaults document selection", () =>
    expect(
      createOwnershipTransferSchema.parse({
        vehicleId: id,
        toUsername: "  Road_Rider  ",
      }),
    ).toEqual({ vehicleId: id, toUsername: "road_rider", documentIds: [] }));
  it("rejects duplicate or forged document ids", () => {
    expect(
      createOwnershipTransferSchema.safeParse({
        vehicleId: id,
        toUsername: "road_rider",
        documentIds: [id, id],
      }).success,
    ).toBe(false);
    expect(
      createOwnershipTransferSchema.safeParse({
        vehicleId: id,
        toUsername: "road_rider",
        documentIds: ["not-a-uuid"],
      }).success,
    ).toBe(false);
  });
  it("requires an explicit archive boolean", () => {
    expect(archiveVehicleSchema.safeParse({ archived: false }).success).toBe(
      true,
    );
    expect(archiveVehicleSchema.safeParse({ archived: "false" }).success).toBe(
      false,
    );
  });
});
