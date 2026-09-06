import type { RideId } from "@/lib/traffic-endless-ride";

export interface RideDefinition {
  readonly acceleration: number;
  readonly color: string;
  readonly height: number;
  readonly hitHeight: number;
  readonly hitWidth: number;
  readonly id: RideId;
  readonly jamReady: boolean;
  readonly kmhMultiplier: number;
  readonly lateralSpeed: number;
  readonly maxSpeed: number;
  readonly multiplier: number;
  readonly narrow: boolean;
  readonly width: number;
}

export interface TrafficDefinition {
  readonly aggressive?: boolean;
  readonly baseSpeed: number;
  readonly colors?: readonly string[];
  readonly fixedColor?: string;
  readonly heavy?: boolean;
  readonly height: number;
  readonly id: string;
  readonly narrow?: boolean;
  readonly noLaneChange?: boolean;
  readonly unlockDistance: number;
  readonly weight: number;
  readonly width: number;
}

export const rides: readonly RideDefinition[] = [
  {
    id: "sedan",
    color: "#2784be",
    width: 46,
    height: 88,
    hitWidth: 44,
    hitHeight: 84,
    lateralSpeed: 430,
    maxSpeed: 600,
    acceleration: 19,
    kmhMultiplier: 0.4,
    narrow: false,
    jamReady: false,
    multiplier: 1,
  },
  {
    id: "sport",
    color: "#e63946",
    width: 44,
    height: 92,
    hitWidth: 42,
    hitHeight: 88,
    lateralSpeed: 520,
    maxSpeed: 700,
    acceleration: 25,
    kmhMultiplier: 0.44,
    narrow: false,
    jamReady: false,
    multiplier: 1.3,
  },
  {
    id: "moto",
    color: "#4dabf7",
    width: 30,
    height: 64,
    hitWidth: 21,
    hitHeight: 56,
    lateralSpeed: 600,
    maxSpeed: 640,
    acceleration: 23,
    kmhMultiplier: 0.42,
    narrow: true,
    jamReady: true,
    multiplier: 1.6,
  },
  {
    id: "cycle",
    color: "#2ec4b6",
    width: 24,
    height: 56,
    hitWidth: 17,
    hitHeight: 48,
    lateralSpeed: 400,
    maxSpeed: 380,
    acceleration: 10,
    kmhMultiplier: 0.088,
    narrow: true,
    jamReady: true,
    multiplier: 0.8,
  },
] as const;

const trafficColors = [
  "#8d99ae",
  "#f4a261",
  "#2a9d8f",
  "#c77dff",
  "#e9ecef",
  "#ff8fa3",
  "#588157",
  "#adb5bd",
] as const;

export const trafficTypes: readonly TrafficDefinition[] = [
  {
    id: "sedan",
    unlockDistance: 0,
    width: 46,
    height: 88,
    baseSpeed: 206,
    weight: 19,
  },
  {
    id: "sport",
    unlockDistance: 0,
    width: 46,
    height: 88,
    baseSpeed: 206,
    weight: 19,
  },
  {
    id: "taxi",
    unlockDistance: 0,
    width: 46,
    height: 88,
    baseSpeed: 222,
    weight: 7,
    fixedColor: "#f7c948",
  },
  {
    id: "suv",
    unlockDistance: 500,
    width: 50,
    height: 98,
    baseSpeed: 192,
    weight: 12,
  },
  {
    id: "tuktuk",
    unlockDistance: 1_100,
    width: 34,
    height: 64,
    baseSpeed: 168,
    weight: 5,
    colors: ["#06d6a0", "#ffd166", "#ef476f"],
  },
  {
    id: "moto",
    unlockDistance: 1_500,
    width: 26,
    height: 56,
    baseSpeed: 280,
    weight: 9,
    narrow: true,
  },
  {
    id: "pickup",
    unlockDistance: 2_100,
    width: 48,
    height: 98,
    baseSpeed: 196,
    weight: 9,
  },
  {
    id: "van",
    unlockDistance: 2_900,
    width: 50,
    height: 106,
    baseSpeed: 174,
    weight: 8,
    colors: ["#e9ecef", "#d8dee4", "#4dabf7"],
  },
  {
    id: "truck",
    unlockDistance: 3_900,
    width: 56,
    height: 132,
    baseSpeed: 150,
    weight: 9,
    noLaneChange: true,
    heavy: true,
  },
  {
    id: "bus",
    unlockDistance: 5_200,
    width: 54,
    height: 152,
    baseSpeed: 140,
    weight: 6,
    noLaneChange: true,
    heavy: true,
    colors: ["#f4a261", "#4dabf7", "#e63946", "#2a9d8f"],
  },
  {
    id: "mixer",
    unlockDistance: 6_800,
    width: 56,
    height: 142,
    baseSpeed: 138,
    weight: 4,
    noLaneChange: true,
    heavy: true,
    colors: ["#f77f00", "#d62828", "#457b9d"],
  },
  {
    id: "semi",
    unlockDistance: 8_500,
    width: 58,
    height: 180,
    baseSpeed: 126,
    weight: 5,
    noLaneChange: true,
    heavy: true,
    colors: ["#c1121f", "#0353a4", "#3a3f47", "#e5b800"],
  },
  {
    id: "police",
    unlockDistance: 10_000,
    width: 46,
    height: 92,
    baseSpeed: 262,
    weight: 4,
    fixedColor: "#f2f4f7",
    aggressive: true,
  },
] as const;

function lights(width: number, height: number) {
  const left = Math.max(5, width * 0.2);
  const right = width - left - 8;
  return `<rect x="${left}" y="3" width="8" height="5" rx="2" fill="#fff9d6"/><rect x="${right}" y="3" width="8" height="5" rx="2" fill="#fff9d6"/><rect x="${left}" y="${height - 7}" width="8" height="4" rx="2" fill="#ff5a5a"/><rect x="${right}" y="${height - 7}" width="8" height="4" rx="2" fill="#ff5a5a"/>`;
}

function carSvg(color: string, width: number, height: number, kind: string) {
  const bodyX = 6;
  const bodyWidth = width - 12;
  const police = kind === "police";
  const taxi = kind === "taxi";
  const stripe = taxi
    ? `<rect x="${bodyX}" y="${height * 0.46}" width="${bodyWidth}" height="7" fill="#171b20"/>`
    : "";
  const beacon = police
    ? `<rect class="policeRed" x="${width / 2 - 11}" y="${height * 0.4}" width="10" height="5" rx="2" fill="#ff2d2d"/><rect class="policeBlue" x="${width / 2 + 1}" y="${height * 0.4}" width="10" height="5" rx="2" fill="#2d6bff"/>`
    : "";
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><rect x="0" y="14" width="7" height="18" rx="3" fill="#15181d"/><rect x="${width - 7}" y="14" width="7" height="18" rx="3" fill="#15181d"/><rect x="0" y="${height - 32}" width="7" height="18" rx="3" fill="#15181d"/><rect x="${width - 7}" y="${height - 32}" width="7" height="18" rx="3" fill="#15181d"/><rect x="${bodyX}" y="4" width="${bodyWidth}" height="${height - 8}" rx="10" fill="${color}"/><path d="M${bodyX + 5} ${height * 0.25} Q${width / 2} ${height * 0.17} ${width - bodyX - 5} ${height * 0.25} L${width - bodyX - 7} ${height * 0.38} L${bodyX + 7} ${height * 0.38}Z" fill="#1b2733"/><rect x="${bodyX + 6}" y="${height * 0.46}" width="${bodyWidth - 12}" height="${height * 0.2}" rx="3" fill="#243244"/>${stripe}${beacon}${lights(width, height)}</svg>`;
}

function heavySvg(color: string, width: number, height: number, kind: string) {
  const cabHeight = kind === "bus" ? height - 8 : Math.min(42, height * 0.34);
  const cargoY = kind === "bus" ? 4 : cabHeight + 4;
  const cargoHeight = kind === "bus" ? height - 8 : height - cargoY - 4;
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><rect x="0" y="18" width="8" height="20" rx="3" fill="#15181d"/><rect x="${width - 8}" y="18" width="8" height="20" rx="3" fill="#15181d"/><rect x="0" y="${height - 36}" width="8" height="22" rx="3" fill="#15181d"/><rect x="${width - 8}" y="${height - 36}" width="8" height="22" rx="3" fill="#15181d"/><rect x="6" y="4" width="${width - 12}" height="${cabHeight - 4}" rx="8" fill="${color}"/><rect x="5" y="${cargoY}" width="${width - 10}" height="${cargoHeight}" rx="6" fill="#e2e6eb" stroke="#9aa3ad" stroke-width="2"/><path d="M12 13 Q${width / 2} 7 ${width - 12} 13 L${width - 14} 25 L14 25Z" fill="#1b2733"/>${lights(width, height)}</svg>`;
}

function narrowSvg(
  color: string,
  width: number,
  height: number,
  cycle: boolean,
) {
  const center = width / 2;
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><rect x="${center - 2}" y="2" width="4" height="14" rx="2" fill="#171b20"/><rect x="${center - 2}" y="${height - 16}" width="4" height="14" rx="2" fill="#171b20"/><path d="M${center - 5} 15 L${center + 5} 15 L${center + 8} ${height - 17} L${center} ${height - 11} L${center - 8} ${height - 17}Z" fill="${color}"/><rect x="3" y="${height * 0.37}" width="${width - 6}" height="3" rx="1.5" fill="#39404b"/><circle cx="${center}" cy="${height * 0.34}" r="${cycle ? 5 : 5.5}" fill="#f2c9a0"/><path d="M${center - 5} ${height * 0.31} A5 5 0 0 1 ${center + 5} ${height * 0.31}Z" fill="${cycle ? "#ff4d4d" : "#2b3240"}"/>${lights(width, height)}</svg>`;
}

export function vehicleSvg(
  definition: RideDefinition | TrafficDefinition,
  color?: string,
): string {
  const chosen =
    color ??
    ("color" in definition
      ? definition.color
      : (definition.fixedColor ?? definition.colors?.[0] ?? trafficColors[0]));
  if (
    definition.id === "moto" ||
    definition.id === "cycle" ||
    definition.id === "tuktuk"
  ) {
    return narrowSvg(
      chosen,
      definition.width,
      definition.height,
      definition.id === "cycle",
    );
  }
  if (("heavy" in definition && definition.heavy) || definition.id === "van") {
    return heavySvg(chosen, definition.width, definition.height, definition.id);
  }
  return carSvg(chosen, definition.width, definition.height, definition.id);
}

export function randomTrafficColor(definition: TrafficDefinition): string {
  if (definition.fixedColor) return definition.fixedColor;
  const colors = definition.colors ?? trafficColors;
  return colors[Math.floor(Math.random() * colors.length)]!;
}
