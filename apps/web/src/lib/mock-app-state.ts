import type { MarketProduct } from "./mock-content";

export interface MockAppState {
  version: 3;
  createdProducts: MarketProduct[];
  followedPhotographerIds: string[];
  selectedProductIds: string[];
  readNotificationIds: string[];
}

export type MockAppAction =
  | { type: "hydrate"; state: MockAppState }
  | { type: "create-product"; product: MarketProduct }
  | { type: "toggle-follow"; photographerId: string }
  | { type: "toggle-product"; productId: string }
  | { type: "read-notification"; notificationId: string }
  | { type: "read-all-notifications"; notificationIds: string[] };

export function defaultMockAppState(): MockAppState {
  return {
    version: 3,
    createdProducts: [],
    followedPhotographerIds: [],
    selectedProductIds: [],
    readNotificationIds: [],
  };
}

export function reduceMockAppState(state: MockAppState, action: MockAppAction): MockAppState {
  switch (action.type) {
    case "hydrate": return action.state;
    case "create-product": return { ...state, createdProducts: [action.product, ...state.createdProducts] };
    case "toggle-follow": return { ...state, followedPhotographerIds: toggle(state.followedPhotographerIds, action.photographerId) };
    case "toggle-product": return { ...state, selectedProductIds: toggle(state.selectedProductIds, action.productId) };
    case "read-notification": return { ...state, readNotificationIds: addUnique(state.readNotificationIds, action.notificationId) };
    case "read-all-notifications": return { ...state, readNotificationIds: Array.from(new Set([...state.readNotificationIds, ...action.notificationIds])) };
  }
}

export function serializeMockAppState(state: MockAppState): string { return JSON.stringify(state); }

export function parseMockAppState(value: string | null): MockAppState {
  if (!value) return defaultMockAppState();
  try {
    const candidate = JSON.parse(value) as Record<string, unknown>;
    if (candidate.version === 1 || candidate.version === 2) return migrateLegacy(candidate);
    if (candidate.version !== 3) return defaultMockAppState();
    return {
      version: 3,
      createdProducts: marketProducts(candidate.createdProducts),
      followedPhotographerIds: strings(candidate.followedPhotographerIds),
      selectedProductIds: strings(candidate.selectedProductIds),
      readNotificationIds: strings(candidate.readNotificationIds),
    };
  } catch { return defaultMockAppState(); }
}

function migrateLegacy(candidate: Record<string, unknown>): MockAppState {
  return {
    ...defaultMockAppState(),
    followedPhotographerIds: strings(candidate.followedPhotographerIds),
    selectedProductIds: strings(candidate.selectedProductIds),
    readNotificationIds: strings(candidate.readNotificationIds),
  };
}

function toggle(values: string[], value: string): string[] { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function addUnique(values: string[], value: string): string[] { return values.includes(value) ? values : [...values, value]; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function marketProducts(value: unknown): MarketProduct[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is MarketProduct =>
          Boolean(
            item &&
              typeof item === "object" &&
              "id" in item &&
              "name" in item &&
              "price" in item,
          ),
      )
    : [];
}
