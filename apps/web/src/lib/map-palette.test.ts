import { describe, expect, it } from "vitest";

import {
  applyMapPalette,
  classifyMapLayer,
  contentKindColors,
  mapPalettes,
} from "./map-palette";

describe("Natural Mist map palette", () => {
  it("assigns each content kind a distinct vivid color", () => {
    expect(contentKindColors).toEqual({
      meeting: "#168568",
      event: "#8e55ad",
      trip: "#536fc3",
      photographerSpot: "#a86a28",
    });
    expect(new Set(Object.values(contentKindColors))).toHaveLength(4);
  });

  it("uses the same Natural Mist vector palette in both app themes", () => {
    expect(mapPalettes.light).toEqual({
      ground: "#e3eae8",
      block: "#d7e0de",
      block2: "#ced9d6",
      road: "#f9fffd",
      edge: "#c6d0ce",
      water: "#c0dee3",
      label: "#45504d",
      veil: "oklch(15% .016 168 / .94)",
    });
    expect(mapPalettes.dark).toBe(mapPalettes.light);
  });
});

describe("classifyMapLayer", () => {
  it.each([
    [{ id: "background", type: "background" }, "ground"],
    [{ id: "water", type: "fill" }, "water"],
    [{ id: "general-land", type: "fill" }, "ground"],
    [{ id: "park-landcover", type: "fill" }, "block"],
    [{ id: "building-3d", type: "fill-extrusion" }, "block2"],
    [{ id: "dense-urban-area", type: "fill" }, "block2"],
    [{ id: "road_primary", type: "line" }, "road"],
    [{ id: "road-casing", type: "line" }, "edge"],
    [{ id: "admin-boundary", type: "line" }, "edge"],
    [{ id: "transit-support", type: "line" }, "edge"],
    [{ id: "place-label", type: "symbol" }, "label"],
    [{ id: "osm", type: "raster" }, "raster"],
    [{ id: "weather", type: "heatmap" }, null],
  ] as const)("classifies %s as %s", (layer, expected) => {
    expect(classifyMapLayer(layer)).toBe(expected);
  });
});

describe("applyMapPalette", () => {
  it("recolors supported vector layers with Natural Mist color and halo paint", () => {
    const calls: Array<[string, string, unknown]> = [];
    const map = {
      getStyle: () => ({
        layers: [
          { id: "background", type: "background" },
          { id: "park", type: "fill" },
          { id: "building", type: "fill-extrusion" },
          { id: "water", type: "fill" },
          { id: "road_primary", type: "line" },
          { id: "road-casing", type: "line" },
          { id: "place-label", type: "symbol" },
        ],
      }),
      setPaintProperty: (id: string, property: string, value: unknown) => {
        calls.push([id, property, value]);
      },
    };

    applyMapPalette(map, "light");

    expect(calls).toContainEqual(["background", "background-color", "#e3eae8"]);
    expect(calls).toContainEqual(["park", "fill-color", "#d7e0de"]);
    expect(calls).toContainEqual(["building", "fill-extrusion-color", "#ced9d6"]);
    expect(calls).toContainEqual(["water", "fill-color", "#c0dee3"]);
    expect(calls).toContainEqual(["road_primary", "line-color", "#f9fffd"]);
    expect(calls).toContainEqual(["road-casing", "line-color", "#c6d0ce"]);
    expect(calls).toContainEqual(["place-label", "text-color", "#45504d"]);
    expect(calls).toContainEqual(["place-label", "text-halo-color", "#f9fffd"]);
    expect(calls).toContainEqual(["place-label", "text-halo-width", 1.1]);
    expect(calls.every(([, property]) => /(?:-color|-halo-width)$/.test(property))).toBe(true);
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
