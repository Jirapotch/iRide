import type { ExploreFeatureKind } from "@iride/types";

import type { AppTheme } from "./app-navigation-domain";

export type SemanticMapLayer =
  | "ground"
  | "block"
  | "water"
  | "block2"
  | "road"
  | "edge"
  | "label"
  | "raster";

export interface MapPalette {
  readonly ground: string;
  readonly block: string;
  readonly block2: string;
  readonly edge: string;
  readonly water: string;
  readonly road: string;
  readonly label: string;
  readonly veil: string;
}

export const naturalMistPalette: MapPalette = {
  ground: "#e3eae8",
  block: "#d7e0de",
  block2: "#ced9d6",
  road: "#f9fffd",
  edge: "#c6d0ce",
  water: "#c0dee3",
  label: "#45504d",
  veil: "oklch(15% .016 168 / .94)",
};

export const mapPalettes: Record<AppTheme, MapPalette> = {
  light: naturalMistPalette,
  dark: naturalMistPalette,
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
const BLOCK_PATTERN = /park|forest|landcover/;
const BLOCK2_PATTERN = /building|dense|urban/;
const ROAD_PATTERN =
  /road|street|transport|motorway|trunk|primary|secondary|tertiary|bridge|tunnel|path/;
const EDGE_PATTERN = /casing|outline|boundary|admin|border|support/;

export function classifyMapLayer(
  layer: MapStyleLayer,
): SemanticMapLayer | null {
  const id = layer.id.toLowerCase();
  if (layer.type === "background") return "ground";
  if (layer.type === "raster") return "raster";
  if (layer.type === "symbol") return "label";
  if (layer.type === "fill-extrusion" && BLOCK2_PATTERN.test(id)) {
    return "block2";
  }
  if (layer.type === "fill") {
    if (WATER_PATTERN.test(id)) return "water";
    if (BLOCK2_PATTERN.test(id)) return "block2";
    if (BLOCK_PATTERN.test(id)) return "block";
    return "ground";
  }
  if (layer.type === "line") {
    if (WATER_PATTERN.test(id)) return "water";
    if (EDGE_PATTERN.test(id)) return "edge";
    if (ROAD_PATTERN.test(id)) return "road";
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

    if (semanticLayer === "ground") {
      if (layer.type === "background") {
        set("background-color", palette.ground);
      } else {
        set("fill-color", palette.ground);
        set("fill-outline-color", palette.edge);
      }
    } else if (semanticLayer === "block") {
      set("fill-color", palette.block);
      set("fill-outline-color", palette.edge);
    } else if (semanticLayer === "water") {
      if (layer.type === "fill") {
        set("fill-color", palette.water);
        set("fill-outline-color", palette.edge);
      } else {
        set("line-color", palette.water);
      }
    } else if (semanticLayer === "block2") {
      const prefix =
        layer.type === "fill-extrusion" ? "fill-extrusion" : "fill";
      set(`${prefix}-color`, palette.block2);
      if (prefix === "fill") set("fill-outline-color", palette.edge);
    } else if (semanticLayer === "road") {
      set("line-color", palette.road);
    } else if (semanticLayer === "edge") {
      set("line-color", palette.edge);
    } else if (semanticLayer === "label") {
      set("text-color", palette.label);
      set("text-halo-color", palette.road);
      set("text-halo-width", 1.1);
    }
  }
}
