import { expect, it } from "vitest";
import { tripParticipationSchema, tripRecapEntrySchema } from "./index";

it("requires an explicit participation state and keeps shared rider details optional", () => {
  expect(
    tripParticipationSchema.safeParse({
      status: "interested",
      vehicleId: null,
      ridingArea: null,
    }).success,
  ).toBe(true);
  expect(
    tripParticipationSchema.safeParse({
      status: "maybe",
      vehicleId: null,
      ridingArea: null,
    }).success,
  ).toBe(false);
});

it("accepts a stop review or photo but not an empty recap contribution", () => {
  expect(
    tripRecapEntrySchema.safeParse({
      stopName: "Cafe",
      review: "Good stop",
      mediaIds: [],
    }).success,
  ).toBe(true);
  expect(
    tripRecapEntrySchema.safeParse({ stopName: null, review: "", mediaIds: [] })
      .success,
  ).toBe(false);
});
