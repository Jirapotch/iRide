import type { ActivityItem } from "./activity-domain";
import type { CommunityPost } from "./mock-content";

export interface MockAppState {
  version: 2;
  joinedActivityIds: string[];
  createdActivities: ActivityItem[];
  posts: CommunityPost[];
  followedPhotographerIds: string[];
  selectedProductIds: string[];
  readNotificationIds: string[];
  viewMode: "map" | "list";
}

export type MockAppAction =
  | { type: "hydrate"; state: MockAppState }
  | { type: "toggle-activity"; activityId: string }
  | { type: "create-activity"; activity: ActivityItem }
  | { type: "create-post"; post: CommunityPost }
  | { type: "toggle-follow"; photographerId: string }
  | { type: "toggle-product"; productId: string }
  | { type: "read-notification"; notificationId: string }
  | { type: "read-all-notifications"; notificationIds: string[] }
  | { type: "set-view-mode"; viewMode: "map" | "list" };

export function defaultMockAppState(): MockAppState {
  return {
    version: 2,
    joinedActivityIds: [],
    createdActivities: [],
    posts: [],
    followedPhotographerIds: [],
    selectedProductIds: [],
    readNotificationIds: [],
    viewMode: "map",
  };
}

export function reduceMockAppState(state: MockAppState, action: MockAppAction): MockAppState {
  switch (action.type) {
    case "hydrate": return action.state;
    case "toggle-activity": return { ...state, joinedActivityIds: toggle(state.joinedActivityIds, action.activityId) };
    case "create-activity": return { ...state, createdActivities: [...state.createdActivities, action.activity] };
    case "create-post": return { ...state, posts: [action.post, ...state.posts] };
    case "toggle-follow": return { ...state, followedPhotographerIds: toggle(state.followedPhotographerIds, action.photographerId) };
    case "toggle-product": return { ...state, selectedProductIds: toggle(state.selectedProductIds, action.productId) };
    case "read-notification": return { ...state, readNotificationIds: addUnique(state.readNotificationIds, action.notificationId) };
    case "read-all-notifications": return { ...state, readNotificationIds: Array.from(new Set([...state.readNotificationIds, ...action.notificationIds])) };
    case "set-view-mode": return { ...state, viewMode: action.viewMode };
  }
}

export function serializeMockAppState(state: MockAppState): string { return JSON.stringify(state); }

export function parseMockAppState(value: string | null): MockAppState {
  if (!value) return defaultMockAppState();
  try {
    const candidate = JSON.parse(value) as Record<string, unknown>;
    if (candidate.version === 1) return migrateVersionOne(candidate);
    if (candidate.version !== 2) return defaultMockAppState();
    return {
      version: 2,
      joinedActivityIds: strings(candidate.joinedActivityIds),
      createdActivities: activities(candidate.createdActivities),
      posts: posts(candidate.posts),
      followedPhotographerIds: strings(candidate.followedPhotographerIds),
      selectedProductIds: strings(candidate.selectedProductIds),
      readNotificationIds: strings(candidate.readNotificationIds),
      viewMode: candidate.viewMode === "list" ? "list" : "map",
    };
  } catch { return defaultMockAppState(); }
}

function migrateVersionOne(candidate: Record<string, unknown>): MockAppState {
  return {
    ...defaultMockAppState(),
    joinedActivityIds: Array.from(new Set([...strings(candidate.savedTripIds), ...strings(candidate.joinedEventIds)])),
    followedPhotographerIds: strings(candidate.followedPhotographerIds),
    selectedProductIds: strings(candidate.selectedProductIds),
    readNotificationIds: strings(candidate.readNotificationIds),
  };
}

function toggle(values: string[], value: string): string[] { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function addUnique(values: string[], value: string): string[] { return values.includes(value) ? values : [...values, value]; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function activities(value: unknown): ActivityItem[] { return Array.isArray(value) ? value.filter((item): item is ActivityItem => Boolean(item && typeof item === "object" && "id" in item)) : []; }
function posts(value: unknown): CommunityPost[] { return Array.isArray(value) ? value.filter((item): item is CommunityPost => Boolean(item && typeof item === "object" && "id" in item)) : []; }
