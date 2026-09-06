import type { SearchResultDto } from "@iride/types";
import type { CommunityCategory } from "@iride/types";
import type { Locale } from "./locale";

export type AppTheme = "light" | "dark";
export type CommunityRoomId = "talk" | "groups";

export interface BreadcrumbItem {
  readonly key: string;
  readonly label: string;
  readonly href?: string;
}

export interface BreadcrumbContext {
  readonly locale: Locale;
  readonly entityLabel?: string;
  readonly parentHref?: string;
  readonly tab?: string;
}

const breadcrumbLabels = {
  th: {
    home: "หน้าหลัก",
    talk: "พูดคุย",
    groups: "กลุ่ม",
    maps: "แผนที่",
    search: "ค้นหา",
    create: "สร้าง",
    notifications: "การแจ้งเตือน",
    manageUsers: "จัดการผู้ใช้",
    garage: "Garage",
    activities: "กิจกรรม",
    profile: "โปรไฟล์",
  },
  en: {
    home: "Home",
    talk: "Talk",
    groups: "Groups",
    maps: "Maps",
    search: "Search",
    create: "Create",
    notifications: "Notifications",
    manageUsers: "Manage users",
    garage: "Garage",
    activities: "Activities",
    profile: "Profile",
  },
} as const;

const vehicleBreadcrumbLabels = {
  car: { th: "รถยนต์", en: "Cars" },
  motorcycle: { th: "มอเตอร์ไซค์", en: "Motorcycles" },
  bicycle: { th: "จักรยาน", en: "Bicycles" },
  groups: { th: "กลุ่ม", en: "Groups" },
} as const;

export function resolveBreadcrumbs(
  pathname: string,
  context: BreadcrumbContext,
): BreadcrumbItem[] {
  const labels = breadcrumbLabels[context.locale];
  const home: BreadcrumbItem = {
    key: "home",
    label: labels.home,
    ...(pathname === "/" ? {} : { href: "/" }),
  };

  if (pathname === "/") return [home];

  const community =
    /^\/community\/(car|motorcycle|bicycle|groups)(?:\/(talk))?$/.exec(
      pathname,
    );
  if (community) {
    const category = community[1] as keyof typeof vehicleBreadcrumbLabels;
    const categoryHref = `/community/${category}`;
    const categoryItem: BreadcrumbItem = {
      key: `community-${category}`,
      label: vehicleBreadcrumbLabels[category][context.locale],
      ...(community[2] ? { href: categoryHref } : {}),
    };
    return community[2]
      ? [home, categoryItem, { key: "community-talk", label: labels.talk }]
      : [home, categoryItem];
  }

  const staticRoute = {
    "/maps": ["maps", labels.maps],
    "/search": ["search", labels.search],
    "/create": ["create", labels.create],
    "/notifications": ["notifications", labels.notifications],
  } as const;
  const staticItem = staticRoute[pathname as keyof typeof staticRoute];
  if (staticItem) {
    return [home, { key: staticItem[0], label: staticItem[1] }];
  }

  const profile = /^\/users\/([^/]+)$/.exec(pathname);
  if (profile) {
    const profileLabel = context.entityLabel ?? labels.profile;
    const profileItem: BreadcrumbItem = {
      key: "profile",
      label: profileLabel,
      ...(context.tab === "garage" || context.tab === "activities"
        ? {
            href: `/users/${encodeURIComponent(decodeURIComponent(profile[1] ?? ""))}`,
          }
        : {}),
    };
    if (context.tab === "garage") {
      return [
        home,
        profileItem,
        { key: "profile-garage", label: labels.garage },
      ];
    }
    if (context.tab === "activities") {
      return [
        home,
        profileItem,
        { key: "profile-activities", label: labels.activities },
      ];
    }
    return [home, profileItem];
  }

  if (pathname === "/settings/users") {
    return [home, { key: "admin-users", label: labels.manageUsers }];
  }

  if (/^\/settings\/users\/[^/]+$/.test(pathname)) {
    return [
      home,
      {
        key: "admin-users",
        label: labels.manageUsers,
        href: context.parentHref ?? "/settings/users",
      },
      {
        key: "admin-user",
        label: context.entityLabel ?? labels.profile,
      },
    ];
  }

  return [home];
}

export function primaryNavigation(username: string | null) {
  return [
    { href: "/", key: "home" as const },
    { href: "/maps", key: "maps" as const },
    { href: "/create", key: "create" as const },
    { href: "/search", key: "search" as const },
    {
      href: username
        ? `/users/${encodeURIComponent(username)}`
        : "/login?intent=profile",
      key: "profile" as const,
    },
  ];
}

export function communityCategoryHref(category: CommunityCategory): string {
  return `/community/${category}`;
}

export function communityTalkHref(category: CommunityCategory): string {
  return category === "car" ||
    category === "motorcycle" ||
    category === "bicycle"
    ? `/community/${category}/talk`
    : communityCategoryHref(category);
}

export function legacyCommunityHref(
  room: string | undefined,
  selection: { readonly post?: string; readonly modal?: string } = {},
): string {
  if (room === "market" || room === "photographers") return "/";
  const pathname = "/community/groups";
  const query = new URLSearchParams();
  if (selection.post) query.set("post", selection.post);
  if (selection.modal === "edit") query.set("modal", "edit");
  return query.size ? `${pathname}?${query}` : pathname;
}

export function publicSearchResults(
  results: readonly SearchResultDto[],
): SearchResultDto[] {
  return [...results];
}

export const communityRooms = [
  { id: "talk", label: { th: "พูดคุย", en: "Talk" } },
  { id: "groups", label: { th: "กลุ่ม", en: "Groups" } },
] as const satisfies readonly {
  readonly id: CommunityRoomId;
  readonly label: { readonly th: string; readonly en: string };
}[];

export interface CommunityDataNeeds {
  readonly posts: boolean;
  readonly events: boolean;
}

export function communityDataNeeds(
  requestedRoom: string | undefined,
): CommunityDataNeeds {
  const room = resolveCommunityRoom(requestedRoom);

  return {
    posts: room === "talk",
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
