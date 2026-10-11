import { describe, expect, it } from "vitest";
import {
  vehicleInput,
  serviceInput,
  validateImage,
  uuid,
  pageInput,
} from "./validation";

describe("garage validation", () => {
  it("accepts a vehicle with only a name and normalizes optional values", () => {
    expect(vehicleInput({ name: "  My car " })).toMatchObject({
      name: "My car",
      brand: null,
      mileageKm: null,
    });
  });
  it("rejects unknown fields and negative or nonnumeric mileage", () => {
    for (const input of [
      { name: "" },
      { name: "Car", ownerId: "someone" },
      { name: "Car", mileageKm: -1 },
      { name: "Car", mileageKm: "100" },
    ])
      expect(() => vehicleInput(input)).toThrow();
  });
  it("requires a real service date and title; preserves optional zero cost", () => {
    expect(
      serviceInput({ title: "Oil", occurredOn: "2026-10-11", cost: 0 }),
    ).toMatchObject({ cost: 0, notes: null });
    expect(() =>
      serviceInput({ title: "Oil", occurredOn: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      serviceInput({ title: "Oil", occurredOn: "2026-10-11", cost: -10 }),
    ).toThrow();
  });
  it("bounds pagination and rejects malformed identifiers", () => {
    expect(pageInput(new URLSearchParams())).toEqual({ page: 1, pageSize: 8 });
    expect(() => pageInput(new URLSearchParams("pageSize=500"))).toThrow();
    expect(() => uuid("../secret")).toThrow();
  });
  it("checks actual image signatures and byte limits, not just browser MIME", () => {
    expect(
      validateImage(new Uint8Array([255, 216, 255, 224]), "image/jpeg"),
    ).toBe("image/jpeg");
    expect(() =>
      validateImage(new Uint8Array([60, 115, 99, 114]), "image/jpeg"),
    ).toThrow();
    expect(() =>
      validateImage(new Uint8Array(4_000_001), "image/png"),
    ).toThrow();
  });
});
