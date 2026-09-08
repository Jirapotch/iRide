import type { ExploreFeatureKind } from "@iride/types";

import type { AppTheme } from "./app-navigation-domain";

export type SemanticMapLayer =
  | "ground"
  | "block"
  | "water"
  | "block2"
  | "road"
  | "edge"
  | "boundary"
  | "label"
  | "poi"
  | "raster";

export interface MapPalette {
  readonly ground: string;
  readonly block: string;
  readonly block2: string;
  readonly edge: string;
  readonly outline: string;
  readonly boundary: string;
  readonly water: string;
  readonly road: string;
  readonly label: string;
  readonly labelHalo: string;
  readonly veil: string;
  readonly rasterSaturation: number;
  readonly rasterContrast: number;
  readonly rasterBrightnessMax: number;
  readonly rasterOpacity: number;
}

export const matchaLattePalette: MapPalette = {
  ground: "#F1F2EF",
  block: "#C4D8A7",
  block2: "#FFFFFF",
  road: "#FFFFFF",
  edge: "#CCD0CC",
  outline: "#D5DAD2",
  boundary: "#C8D1C3",
  water: "#AED3D8",
  label: "#45534B",
  labelHalo: "#FBFAF5",
  veil: "rgb(79 111 82 / .08)",
  rasterSaturation: -0.12,
  rasterContrast: -0.08,
  rasterBrightnessMax: 0.92,
  rasterOpacity: 1,
};

export const mapPalettes: Record<AppTheme, MapPalette> = {
  light: matchaLattePalette,
  dark: matchaLattePalette,
};

export const contentKindColors: Record<ExploreFeatureKind, string> = {
  meeting: "#4F6F52",
  event: "#6B7F5B",
  trip: "#254F80",
};

interface MapStyleLayer {
  readonly id: string;
  readonly type: string;
  readonly "source-layer"?: string;
  readonly filter?: unknown;
}

interface MapPaletteTarget {
  readonly getStyle: () =>
    { readonly layers?: readonly MapStyleLayer[] } | undefined;
  readonly setPaintProperty: unknown;
}

const WATER_PATTERN = /water|ocean|river|lake|stream|canal|basin/;
const BLOCK_PATTERN = /park|forest|landcover/;
const BLOCK2_PATTERN = /building|dense|urban/;
const ROAD_TOKENS = new Set([
  "road",
  "street",
  "highway",
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
  "guideway",
  "track",
  "bridge",
  "tunnel",
  "path",
  "pedestrian",
]);
const NON_ROAD_TRANSPORT_TOKENS = new Set([
  "aerialway",
  "aeroway",
  "cableway",
  "ferry",
  "rail",
  "railway",
  "runway",
  "shipping",
  "subway",
  "tram",
  "transit",
]);
const ROAD_EDGE_TOKENS = new Set(["border", "casing", "outline", "support"]);
const BOUNDARY_TOKENS = new Set([
  "admin",
  "administrative",
  "border",
  "boundary",
]);
const POI_PATTERN = /poi|point.?of.?interest|amenity|shop|tourism/;

function textTokens(value: string): ReadonlySet<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

function isClassSelector(value: unknown): boolean {
  return (
    value === "class" ||
    (Array.isArray(value) && value[0] === "get" && value[1] === "class")
  );
}

function addFilterValueTokens(tokens: Set<string>, value: unknown): void {
  if (typeof value === "string") {
    for (const token of textTokens(value)) tokens.add(token);
  } else if (Array.isArray(value)) {
    for (const item of value) addFilterValueTokens(tokens, item);
  }
}

function positiveRoadClassTokens(filter: unknown): ReadonlySet<string> {
  const tokens = new Set<string>();

  const visit = (expression: unknown): void => {
    if (!Array.isArray(expression) || expression.length === 0) return;

    const [operator, selector, ...values] = expression;
    if (operator === "all" || operator === "any") {
      for (const child of expression.slice(1)) visit(child);
      return;
    }

    // Values in negated predicates are exclusions, not selected layer classes.
    if (
      operator === "!" ||
      operator === "none" ||
      operator === "!in" ||
      operator === "!="
    ) {
      return;
    }

    if ((operator === "in" || operator === "==") && isClassSelector(selector)) {
      for (const value of values) addFilterValueTokens(tokens, value);
      return;
    }

    if (operator === "match" && isClassSelector(selector)) {
      for (let index = 0; index + 1 < values.length; index += 2) {
        const labels = values[index];
        const output = values[index + 1];
        if (output === true) addFilterValueTokens(tokens, labels);
      }
    }
  };

  visit(filter);
  return tokens;
}

function hasAnyToken(
  tokens: ReadonlySet<string>,
  candidates: ReadonlySet<string>,
): boolean {
  return Array.from(candidates).some((candidate) => tokens.has(candidate));
}

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

    const idTokens = textTokens(id);
    if (hasAnyToken(idTokens, NON_ROAD_TRANSPORT_TOKENS)) return null;
    if (hasAnyToken(idTokens, ROAD_TOKENS)) {
      return hasAnyToken(idTokens, ROAD_EDGE_TOKENS) ? "edge" : "road";
    }
    if (hasAnyToken(idTokens, BOUNDARY_TOKENS)) return "boundary";

    const classTokens = positiveRoadClassTokens(layer.filter);
    if (hasAnyToken(classTokens, NON_ROAD_TRANSPORT_TOKENS)) return null;
    if (hasAnyToken(classTokens, ROAD_TOKENS)) return "road";
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
        set("fill-outline-color", palette.outline);
      }
    } else if (semanticLayer === "block") {
      set("fill-color", palette.block);
      set("fill-outline-color", palette.outline);
    } else if (semanticLayer === "water") {
      if (layer.type === "fill") {
        set("fill-color", palette.water);
        set("fill-outline-color", palette.outline);
      } else {
        set("line-color", palette.water);
      }
    } else if (semanticLayer === "block2") {
      const prefix =
        layer.type === "fill-extrusion" ? "fill-extrusion" : "fill";
      set(`${prefix}-color`, palette.block2);
      if (prefix === "fill") set("fill-outline-color", palette.outline);
    } else if (semanticLayer === "road") {
      set("line-color", palette.road);
    } else if (semanticLayer === "edge") {
      set("line-color", palette.edge);
    } else if (semanticLayer === "boundary") {
      set("line-color", palette.boundary);
    } else if (semanticLayer === "label" || semanticLayer === "poi") {
      set("text-color", palette.label);
      set("text-halo-color", palette.labelHalo);
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
