import { describe, expect, it } from "vitest";

import {
  applyMapPalette,
  classifyMapLayer,
  contentKindColors,
  mapPalettes,
} from "./map-palette";

describe("Natural Mist map palette", () => {
  it("assigns each content kind a distinct natural marker tone", () => {
    expect(contentKindColors).toEqual({
      meeting: "#4F6F52",
      event: "#6B7F5B",
      trip: "#4F7770",
    });
    expect(new Set(Object.values(contentKindColors))).toHaveLength(3);
  });

  it("uses the approved Matcha Latte vector palette in both app themes", () => {
    expect(mapPalettes.light).toEqual({
      ground: "#F6F3E8",
      block: "#D9DFC7",
      block2: "#E7E1D3",
      road: "#FBFAF5",
      edge: "#C8D1C3",
      water: "#BCD7D0",
      label: "#4B5D51",
      veil: "rgb(79 111 82 / .08)",
      rasterSaturation: -0.55,
      rasterContrast: -0.08,
      rasterBrightnessMax: 0.92,
      rasterOpacity: 0.82,
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
    [{ id: "poi-label", type: "symbol" }, "poi"],
    [{ id: "place-label", type: "symbol" }, "label"],
    [{ id: "osm", type: "raster" }, "raster"],
    [{ id: "weather", type: "heatmap" }, null],
  ] as const)("classifies %s as %s", (layer, expected) => {
    expect(classifyMapLayer(layer)).toBe(expected);
  });
});

describe("applyMapPalette", () => {
  it("recolors supported vector and raster layers with Matcha hierarchy", () => {
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
          { id: "poi-label", type: "symbol" },
          { id: "osm", type: "raster" },
        ],
      }),
      setPaintProperty: (id: string, property: string, value: unknown) => {
        calls.push([id, property, value]);
      },
    };

    applyMapPalette(map, "light");

    expect(calls).toContainEqual(["background", "background-color", "#F6F3E8"]);
    expect(calls).toContainEqual(["park", "fill-color", "#D9DFC7"]);
    expect(calls).toContainEqual([
      "building",
      "fill-extrusion-color",
      "#E7E1D3",
    ]);
    expect(calls).toContainEqual(["water", "fill-color", "#BCD7D0"]);
    expect(calls).toContainEqual(["road_primary", "line-color", "#FBFAF5"]);
    expect(calls).toContainEqual(["road-casing", "line-color", "#C8D1C3"]);
    expect(calls).toContainEqual(["place-label", "text-color", "#4B5D51"]);
    expect(calls).toContainEqual(["place-label", "text-halo-color", "#FBFAF5"]);
    expect(calls).toContainEqual(["place-label", "text-halo-width", 1.1]);
    expect(calls).toContainEqual(["place-label", "icon-opacity", 0.55]);
    expect(calls).toContainEqual(["poi-label", "text-opacity", 0.48]);
    expect(calls).toContainEqual(["poi-label", "icon-opacity", 0.38]);
    expect(calls).toContainEqual(["osm", "raster-saturation", -0.55]);
    expect(calls).toContainEqual(["osm", "raster-contrast", -0.08]);
    expect(calls).toContainEqual(["osm", "raster-brightness-max", 0.92]);
    expect(calls).toContainEqual(["osm", "raster-opacity", 0.82]);
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
