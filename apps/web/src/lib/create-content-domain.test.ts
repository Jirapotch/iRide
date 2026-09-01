import { describe, expect, it } from "vitest";
import { createContentTypes, postDestination } from "./create-content-domain";

describe("create content domain", () => {
  it("exposes only the four enabled create types", () => {
    expect(createContentTypes).toEqual(["post", "activity", "trip", "photographer-spot"]);
  });

  it.each([
    ["car", "p1", "/community/car/talk?post=p1"],
    ["photographers", "p2", "/community/photographers?post=p2"],
    ["groups", "p3", "/community/groups?post=p3"],
  ] as const)("routes %s posts to their feed", (category, id, expected) => {
    expect(postDestination(category, id)).toBe(expected);
  });
});
