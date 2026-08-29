import { describe, expect, it } from "vitest";

import {
  applyMapPalette,
  classifyMapLayer,
  contentKindColors,
  mapPalettes,
} from "./map-palette";

describe("paper mint map palette", () => {
  it("assigns each content kind a distinct vivid color", () => {
    expect(contentKindColors).toEqual({
      meeting: "#168568",
      event: "#8e55ad",
      trip: "#536fc3",
      photographerSpot: "#a86a28",
    });
    expect(new Set(Object.values(contentKindColors))).toHaveLength(4);
  });

  it("keeps labels readable against distinct light and dark surfaces", () => {
    expect(mapPalettes.light).toMatchObject({
      background: "#edf4f1",
      label: "#20312c",
      water: "#d7ebe8",
    });
    expect(mapPalettes.dark).toMatchObject({
      background: "#182521",
      label: "#e8f1ed",
      water: "#1b3839",
    });
  });
});

describe("classifyMapLayer", () => {
  it.each([
    [{ id: "background", type: "background" }, "background"],
    [{ id: "water", type: "fill" }, "water"],
    [{ id: "park-landcover", type: "fill" }, "land"],
    [{ id: "building-3d", type: "fill-extrusion" }, "building"],
    [{ id: "road_primary", type: "line" }, "road"],
    [{ id: "admin-boundary", type: "line" }, "boundary"],
    [{ id: "place-label", type: "symbol" }, "label"],
    [{ id: "osm", type: "raster" }, "raster"],
    [{ id: "weather", type: "heatmap" }, null],
  ] as const)("classifies %s as %s", (layer, expected) => {
    expect(classifyMapLayer(layer)).toBe(expected);
  });
});

describe("applyMapPalette", () => {
  it("recolors supported vector layers with semantic paint properties", () => {
    const calls: Array<[string, string, unknown]> = [];
    const map = {
      getStyle: () => ({
        layers: [
          { id: "background", type: "background" },
          { id: "water", type: "fill" },
          { id: "road_primary", type: "line" },
          { id: "place-label", type: "symbol" },
        ],
      }),
      setPaintProperty: (id: string, property: string, value: unknown) => {
        calls.push([id, property, value]);
      },
    };

    applyMapPalette(map, "light");

    expect(calls).toContainEqual(["background", "background-color", "#edf4f1"]);
    expect(calls).toContainEqual(["water", "fill-color", "#d7ebe8"]);
    expect(calls).toContainEqual(["road_primary", "line-color", "#fbfdfc"]);
    expect(calls).toContainEqual(["place-label", "text-color", "#20312c"]);
  });

  it("continues styling after an unsupported property throws", () => {
    const calls: string[] = [];
    const map = {
      getStyle: () => ({
        layers: [
          { id: "water", type: "fill" },
          { id: "admin-boundary", type: "line" },
        ],
      }),
      setPaintProperty: (id: string, property: string) => {
        if (id === "water" && property === "fill-color") {
          throw new Error("unsupported paint property");
        }
        calls.push(`${id}:${property}`);
      },
    };

    expect(() => applyMapPalette(map, "dark")).not.toThrow();
    expect(calls).toContain("admin-boundary:line-color");
  });
});
