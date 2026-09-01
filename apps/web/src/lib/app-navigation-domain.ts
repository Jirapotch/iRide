import type { SearchResultDto } from "@iride/types";
import type { CommunityCategory } from "@iride/types";

export type AppTheme = "light" | "dark";
export type CommunityRoomId = "talk" | "market" | "photographers" | "groups";

export function primaryNavigation(username: string | null) {
  return [
    { href: "/", key: "home" as const },
    { href: "/maps", key: "maps" as const },
    { href: "/create", key: "create" as const },
    { href: "/search", key: "search" as const },
    {
      href: username ? `/users/${encodeURIComponent(username)}` : "/login?intent=profile",
      key: "profile" as const,
    },
  ];
}

export function communityCategoryHref(category: CommunityCategory): string {
  return `/community/${category}`;
}

export function communityTalkHref(category: CommunityCategory): string {
  return category === "car" || category === "motorcycle" || category === "bicycle"
    ? `/community/${category}/talk`
    : communityCategoryHref(category);
}

export function legacyCommunityHref(
  room: string | undefined,
  selection: { readonly post?: string; readonly modal?: string } = {},
): string {
  if (room === "market") return "/community/motorcycle/market";
  const pathname = room === "photographers" ? "/community/photographers" : "/community/groups";
  const query = new URLSearchParams();
  if (selection.post) query.set("post", selection.post);
  if (selection.modal === "edit") query.set("modal", "edit");
  return query.size ? `${pathname}?${query}` : pathname;
}

export function publicSearchResults(results: readonly SearchResultDto[]): SearchResultDto[] {
  return results.filter((result) => result.kind !== "marketProduct");
}

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
    return `${communityTalkHref(result.communityCategory ?? "groups")}?post=${encodeURIComponent(result.id)}`;
  }
  return `/maps?marker=${encodeURIComponent(result.id)}`;
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
