import { describe, expect, it } from "vitest";

import { updateProfileSchema, usernameSchema } from "./index";

describe("profile validation", () => {
  it("canonicalizes valid usernames", () => {
    expect(usernameSchema.parse("  Road_Runner  ")).toBe("road_runner");
  });

  it.each(["ab", "contains-dash", "admin", "ชื่อไทย"])(
    "rejects invalid or reserved username %s",
    (username) =>
      expect(usernameSchema.safeParse(username).success).toBe(false),
  );

  it("trims fields and accepts paired coordinates", () => {
    expect(
      updateProfileSchema.parse({
        displayName: " Rider ",
        bio: " ",
        latitude: 13.75,
        longitude: 100.5,
      }),
    ).toEqual({
      displayName: "Rider",
      bio: null,
      latitude: 13.75,
      longitude: 100.5,
    });
  });

  it("rejects unpaired coordinates and unknown fields", () => {
    expect(updateProfileSchema.safeParse({ latitude: 13.75 }).success).toBe(
      false,
    );
    expect(
      updateProfileSchema.safeParse({ email: "private@example.test" }).success,
    ).toBe(false);
  });
});
