import { describe, expect, it } from "vitest";

import {
  communityCategories,
  createHealthResponse,
  serviceNames,
} from "./index";

describe("health contract", () => {
  it.each(serviceNames)("creates a valid %s response", (service) => {
    expect(createHealthResponse(service, "1.2.3")).toEqual({
      status: "ok",
      service,
      version: "1.2.3",
    });
  });
});

describe("community category contract", () => {
  it("exposes the supported community categories", () => {
    expect(communityCategories).toEqual([
      "car",
      "motorcycle",
      "bicycle",
      "groups",
    ]);
  });
});
