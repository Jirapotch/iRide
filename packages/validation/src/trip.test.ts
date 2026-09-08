import { describe, expect, it } from "vitest";
import { createEventSchema, updateEventSchema } from "./index";

const trip = {
  kind: "trip",
  title: "เชียงใหม่",
  description: null,
  locationLabel: null,
  latitude: null,
  longitude: null,
  destinationLabel: "เชียงใหม่",
  destinationLatitude: 18.79,
  destinationLongitude: 98.98,
  startsAt: null,
  endsAt: null,
  timezone: "Asia/Bangkok",
  vehicleKinds: ["car"],
  stops: [],
};
describe("destination-first trips", () => {
  it("accepts a destination without an origin or schedule", () => {
    expect(createEventSchema.safeParse(trip).success).toBe(true);
  });
  it("still requires an activity location and start time", () => {
    expect(
      createEventSchema.safeParse({ ...trip, kind: "meeting" }).success,
    ).toBe(false);
  });
  it("accepts explicit clearing in edits", () => {
    expect(
      updateEventSchema.safeParse({
        startsAt: null,
        locationLabel: null,
        latitude: null,
        longitude: null,
      }).success,
    ).toBe(true);
  });
  it("requires a complete origin and at most twenty valid stops", () => {
    expect(createEventSchema.safeParse({ ...trip, latitude: 13 }).success).toBe(
      false,
    );
    const stop = { name: "แวะพัก", latitude: 15, longitude: 100 };
    expect(
      createEventSchema.safeParse({ ...trip, stops: [stop] }).success,
    ).toBe(true);
    expect(
      createEventSchema.safeParse({ ...trip, stops: Array(21).fill(stop) })
        .success,
    ).toBe(false);
    expect(
      createEventSchema.safeParse({
        ...trip,
        stops: [{ ...stop, latitude: 91 }],
      }).success,
    ).toBe(false);
  });
});
