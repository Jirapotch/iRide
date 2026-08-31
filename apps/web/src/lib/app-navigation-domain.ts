import type { SearchResultDto } from "@iride/types";

export type AppTheme = "light" | "dark";
export type CommunityRoomId = "talk" | "market" | "photographers" | "groups";

export const communityRooms = [
  { id: "talk", label: { th: "พูดคุย", en: "Talk" } },
  { id: "market", label: { th: "Market", en: "Market" } },
  { id: "photographers", label: { th: "ช่างภาพ", en: "Photographers" } },
  { id: "groups", label: { th: "กลุ่ม", en: "Groups" } },
] as const satisfies readonly {
  readonly id: CommunityRoomId;
  readonly label: { readonly th: string; readonly en: string };
}[];

export interface CommunityDataNeeds {
  readonly posts: boolean;
  readonly products: boolean;
  readonly spots: boolean;
  readonly events: boolean;
}

export function communityDataNeeds(
  requestedRoom: string | undefined,
): CommunityDataNeeds {
  const room = resolveCommunityRoom(requestedRoom);

  return {
    posts: room === "talk",
    products: room === "market",
    spots: room === "talk" || room === "photographers",
    events: room === "talk",
  };
}

export function resolveCommunityRoom(
  requestedRoom: string | undefined,
): CommunityRoomId {
  return communityRooms.some(({ id }) => id === requestedRoom)
    ? (requestedRoom as CommunityRoomId)
    : "talk";
}

export function searchResultHref(result: SearchResultDto): string {
  if (result.kind === "profile" && result.username) {
    return `/users/${encodeURIComponent(result.username)}`;
  }
  if (result.kind === "post") {
    return `/community?room=talk&post=${encodeURIComponent(result.id)}`;
  }
  if (result.kind === "marketProduct") {
    return `/community?room=market&product=${encodeURIComponent(result.id)}`;
  }
  return `/?marker=${encodeURIComponent(result.id)}`;
}

export function resolveTheme(
  stored: string | null | undefined,
  systemPrefersDark: boolean,
): AppTheme {
  void systemPrefersDark;
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

export function mapStyle(mapTilerKey: string | undefined) {
  const key = mapTilerKey?.trim();
  if (key) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(key)}`;
  }
  return {
    version: 8 as const,
    sources: {
      osm: {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
  };
}
