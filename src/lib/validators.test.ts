import { describe, expect, it } from "vitest";
import { commentSchema, postSchema, profileSchema, vehicleSchema } from "@/lib/validators";

describe("iRide validation", () => {
  it("accepts a complete profile", () => expect(profileSchema.safeParse({ username: "narin.drives", displayName: "Narin", bio: "Roads", location: "Chiang Mai", locale: "th" }).success).toBe(true));
  it("rejects unsafe usernames", () => expect(profileSchema.safeParse({ username: "Admin User!", displayName: "Admin", locale: "en" }).success).toBe(false));
  it("validates vehicle year", () => expect(vehicleSchema.safeParse({ nickname: "Mochi", make: "Mazda", model: "MX-5", year: 1880 }).success).toBe(false));
  it("requires post content", () => expect(postSchema.safeParse({ body: "", vehicleId: "" }).success).toBe(false));
  it("limits comment length", () => expect(commentSchema.safeParse({ postId: crypto.randomUUID(), body: "x".repeat(501) }).success).toBe(false));
});
