import type { ExploreFeatureKind } from "@iride/types";

import type { AppTheme } from "./app-navigation-domain";

export type SemanticMapLayer =
  | "background"
  | "land"
  | "water"
  | "building"
  | "road"
  | "boundary"
  | "label"
  | "raster";

export interface MapPalette {
  readonly background: string;
  readonly land: string;
  readonly water: string;
  readonly waterEdge: string;
  readonly building: string;
  readonly road: string;
  readonly roadMinor: string;
  readonly roadCasing: string;
  readonly boundary: string;
  readonly label: string;
  readonly labelHalo: string;
}

export const mapPalettes: Record<AppTheme, MapPalette> = {
  light: {
    background: "#edf4f1",
    land: "#f3f8f6",
    water: "#d7ebe8",
    waterEdge: "#c1ddd8",
    building: "#e4ece9",
    road: "#fbfdfc",
    roadMinor: "#f7faf8",
    roadCasing: "#d9e4e0",
    boundary: "#bdcdc7",
    label: "#20312c",
    labelHalo: "#f8fbfa",
  },
  dark: {
    background: "#182521",
    land: "#1d2d28",
    water: "#1b3839",
    waterEdge: "#285153",
    building: "#263832",
    road: "#40534c",
    roadMinor: "#34463f",
    roadCasing: "#14201c",
    boundary: "#536b62",
    label: "#e8f1ed",
    labelHalo: "#17231f",
  },
};

export const contentKindColors: Record<ExploreFeatureKind, string> = {
  meeting: "#168568",
  event: "#8e55ad",
  trip: "#536fc3",
  photographerSpot: "#a86a28",
};

interface MapStyleLayer {
  readonly id: string;
  readonly type: string;
}

interface MapPaletteTarget {
  readonly getStyle: () =>
    { readonly layers?: readonly MapStyleLayer[] } | undefined;
  readonly setPaintProperty: unknown;
}

const WATER_PATTERN = /water|ocean|river|lake|stream|canal|basin/;
const BUILDING_PATTERN = /building/;
const ROAD_PATTERN =
  /road|street|transport|motorway|trunk|primary|secondary|tertiary|bridge|tunnel|path/;
const BOUNDARY_PATTERN = /boundary|admin|border/;
const MAJOR_ROAD_PATTERN = /motorway|trunk|primary/;
const ROAD_CASING_PATTERN = /casing|outline/;

export function classifyMapLayer(
  layer: MapStyleLayer,
): SemanticMapLayer | null {
  const id = layer.id.toLowerCase();
  if (layer.type === "background") return "background";
  if (layer.type === "raster") return "raster";
  if (layer.type === "symbol") return "label";
  if (layer.type === "fill-extrusion" && BUILDING_PATTERN.test(id)) {
    return "building";
  }
  if (layer.type === "fill") {
    if (WATER_PATTERN.test(id)) return "water";
    if (BUILDING_PATTERN.test(id)) return "building";
    return "land";
  }
  if (layer.type === "line") {
    if (WATER_PATTERN.test(id)) return "water";
    if (ROAD_PATTERN.test(id)) return "road";
    if (BOUNDARY_PATTERN.test(id)) return "boundary";
  }
  return null;
}

export function applyMapPalette(map: MapPaletteTarget, theme: AppTheme): void {
  const palette = mapPalettes[theme];
  const setPaintProperty = map.setPaintProperty as (
    layerId: string,
    property: string,
    value: unknown,
  ) => unknown;
  for (const layer of map.getStyle()?.layers ?? []) {
    const semanticLayer = classifyMapLayer(layer);
    const set = (property: string, value: unknown) => {
      try {
        setPaintProperty.call(map, layer.id, property, value);
      } catch {
        // Vendor styles can expose layers whose paint properties are immutable.
      }
    };

    if (semanticLayer === "background") {
      set("background-color", palette.background);
    } else if (semanticLayer === "land") {
      set("fill-color", palette.land);
      set("fill-outline-color", palette.roadCasing);
    } else if (semanticLayer === "water") {
      if (layer.type === "fill") {
        set("fill-color", palette.water);
        set("fill-outline-color", palette.waterEdge);
      } else {
        set("line-color", palette.waterEdge);
      }
    } else if (semanticLayer === "building") {
      const prefix =
        layer.type === "fill-extrusion" ? "fill-extrusion" : "fill";
      set(`${prefix}-color`, palette.building);
      if (prefix === "fill") set("fill-outline-color", palette.roadCasing);
    } else if (semanticLayer === "road") {
      const id = layer.id.toLowerCase();
      const color = ROAD_CASING_PATTERN.test(id)
        ? palette.roadCasing
        : MAJOR_ROAD_PATTERN.test(id)
          ? palette.road
          : palette.roadMinor;
      set("line-color", color);
    } else if (semanticLayer === "boundary") {
      set("line-color", palette.boundary);
    } else if (semanticLayer === "label") {
      set("text-color", palette.label);
      set("text-halo-color", palette.labelHalo);
      set("text-halo-width", 1.25);
    }
  }
}
