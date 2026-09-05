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
    });
    expect(new Set(Object.values(contentKindColors))).toHaveLength(3);
  });

  it("uses the approved Soft Mint vector palette in both app themes", () => {
    expect(mapPalettes.light).toEqual({
      ground: "#F2F3ED",
      block: "#B9DC69",
      block2: "#E8E9E3",
      road: "#FFFFFF",
      edge: "#E4E6E1",
      water: "#BFE3D8",
      label: "#89928D",
      veil: "rgb(242 243 237 / .18)",
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

    expect(calls).toContainEqual(["background", "background-color", "#F2F3ED"]);
    expect(calls).toContainEqual(["park", "fill-color", "#B9DC69"]);
    expect(calls).toContainEqual([
      "building",
      "fill-extrusion-color",
      "#E8E9E3",
    ]);
    expect(calls).toContainEqual(["water", "fill-color", "#BFE3D8"]);
    expect(calls).toContainEqual(["road_primary", "line-color", "#FFFFFF"]);
    expect(calls).toContainEqual(["road-casing", "line-color", "#E4E6E1"]);
    expect(calls).toContainEqual(["place-label", "text-color", "#89928D"]);
    expect(calls).toContainEqual(["place-label", "text-halo-color", "#FFFFFF"]);
    expect(calls).toContainEqual(["place-label", "text-halo-width", 1.1]);
    expect(
      calls.every(([, property]) => /(?:-color|-halo-width)$/.test(property)),
    ).toBe(true);
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
