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
  | "poi"
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
  readonly rasterSaturation: number;
  readonly rasterContrast: number;
  readonly rasterBrightnessMax: number;
  readonly rasterOpacity: number;
}

export const matchaLattePalette: MapPalette = {
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
};

export const mapPalettes: Record<AppTheme, MapPalette> = {
  light: matchaLattePalette,
  dark: matchaLattePalette,
};

export const contentKindColors: Record<ExploreFeatureKind, string> = {
  meeting: "#4F6F52",
  event: "#6B7F5B",
  trip: "#4F7770",
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
const POI_PATTERN = /poi|point.?of.?interest|amenity|shop|tourism/;

export function classifyMapLayer(
  layer: MapStyleLayer,
): SemanticMapLayer | null {
  const id = layer.id.toLowerCase();
  if (layer.type === "background") return "ground";
  if (layer.type === "raster") return "raster";
  if (layer.type === "symbol") {
    return POI_PATTERN.test(id) ? "poi" : "label";
  }
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
    } else if (semanticLayer === "label" || semanticLayer === "poi") {
      set("text-color", palette.label);
      set("text-halo-color", palette.road);
      set("text-halo-width", 1.1);
      if (semanticLayer === "poi") {
        set("text-opacity", 0.48);
        set("icon-opacity", 0.38);
      } else {
        set("icon-opacity", 0.55);
      }
    } else if (semanticLayer === "raster") {
      set("raster-saturation", palette.rasterSaturation);
      set("raster-contrast", palette.rasterContrast);
      set("raster-brightness-max", palette.rasterBrightnessMax);
      set("raster-opacity", palette.rasterOpacity);
    }
  }
}
