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
      road: "#D5D8D2",
      edge: "#BEC4BC",
      outline: "#C8D1C3",
      boundary: "#C8D1C3",
      water: "#BCD7D0",
      label: "#4B5D51",
      labelHalo: "#FBFAF5",
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
    [{ id: "road_motorway", type: "line" }, "road"],
    [{ id: "road_trunk_primary", type: "line" }, "road"],
    [{ id: "road_secondary_tertiary", type: "line" }, "road"],
    [{ id: "highway-primary", type: "line" }, "road"],
    [
      {
        id: "transport",
        type: "line",
        "source-layer": "transportation",
        filter: ["==", ["get", "class"], "primary"],
      },
      "road",
    ],
    [{ id: "road-casing", type: "line" }, "edge"],
    [{ id: "road_motorway_casing", type: "line" }, "edge"],
    [{ id: "tunnel_trunk_primary_casing", type: "line" }, "edge"],
    [{ id: "bridge_secondary_tertiary_casing", type: "line" }, "edge"],
    [{ id: "road-border", type: "line" }, "edge"],
    [{ id: "admin-boundary", type: "line" }, "boundary"],
    [{ id: "country-border", type: "line" }, "boundary"],
    [{ id: "railway_transit", type: "line" }, null],
    [{ id: "transit-support", type: "line" }, null],
    [{ id: "aeroway_runway", type: "line" }, null],
    [{ id: "ferry", type: "line" }, null],
    [
      {
        id: "transportation",
        type: "line",
        "source-layer": "transportation",
        filter: ["==", ["get", "class"], "rail"],
      },
      null,
    ],
    [
      {
        id: "transportation",
        type: "line",
        "source-layer": "transportation",
        filter: [
          "all",
          ["!in", "class", "rail", "transit", "ferry"],
          ["in", "class", "motorway", "trunk", "primary"],
        ],
      },
      "road",
    ],
    [{ id: "poi-label", type: "symbol" }, "poi"],
    [{ id: "place-label", type: "symbol" }, "label"],
    [{ id: "osm", type: "raster" }, "raster"],
    [{ id: "weather", type: "heatmap" }, null],
  ] as const)("classifies %s as %s", (layer, expected) => {
    expect(classifyMapLayer(layer)).toBe(expected);
  });

  it.each([
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "minor",
    "service",
    "residential",
    "unclassified",
    "raceway",
    "busway",
    "bus_guideway",
    "track",
    "path",
    "pedestrian",
  ])("recognizes the %s transportation class as a road", (roadClass) => {
    expect(
      classifyMapLayer({
        id: "transportation",
        type: "line",
        "source-layer": "transportation",
        filter: ["==", ["get", "class"], roadClass],
      }),
    ).toBe("road");
  });

  it("reads positively matched road classes without treating the fallback as a class", () => {
    expect(
      classifyMapLayer({
        id: "transportation",
        type: "line",
        "source-layer": "transportation",
        filter: [
          "match",
          ["get", "class"],
          ["motorway", "trunk", "primary"],
          true,
          false,
        ],
      }),
    ).toBe("road");
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
          { id: "building-fill", type: "fill" },
          { id: "water", type: "fill" },
          { id: "road_motorway", type: "line" },
          { id: "road_trunk_primary", type: "line" },
          { id: "road_secondary_tertiary", type: "line" },
          { id: "road_motorway_casing", type: "line" },
          { id: "admin-boundary", type: "line" },
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
    expect(calls).toContainEqual(["park", "fill-outline-color", "#C8D1C3"]);
    expect(calls).toContainEqual([
      "building",
      "fill-extrusion-color",
      "#E7E1D3",
    ]);
    expect(calls).toContainEqual([
      "building-fill",
      "fill-outline-color",
      "#C8D1C3",
    ]);
    expect(calls).toContainEqual(["water", "fill-color", "#BCD7D0"]);
    expect(calls).toContainEqual(["water", "fill-outline-color", "#C8D1C3"]);
    expect(calls).toContainEqual(["road_motorway", "line-color", "#D5D8D2"]);
    expect(calls).toContainEqual([
      "road_trunk_primary",
      "line-color",
      "#D5D8D2",
    ]);
    expect(calls).toContainEqual([
      "road_secondary_tertiary",
      "line-color",
      "#D5D8D2",
    ]);
    expect(calls).toContainEqual([
      "road_motorway_casing",
      "line-color",
      "#BEC4BC",
    ]);
    expect(calls).toContainEqual(["admin-boundary", "line-color", "#C8D1C3"]);
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
