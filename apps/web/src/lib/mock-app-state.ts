export interface MockAppState {
  version: 5;
  readNotificationIds: string[];
}

export type MockAppAction =
  | { type: "hydrate"; state: MockAppState }
  | { type: "read-notification"; notificationId: string }
  | { type: "read-all-notifications"; notificationIds: string[] };

export function defaultMockAppState(): MockAppState {
  return {
    version: 5,
    readNotificationIds: [],
  };
}

export function reduceMockAppState(state: MockAppState, action: MockAppAction): MockAppState {
  switch (action.type) {
    case "hydrate": return action.state;
    case "read-notification": return { ...state, readNotificationIds: addUnique(state.readNotificationIds, action.notificationId) };
    case "read-all-notifications": return { ...state, readNotificationIds: Array.from(new Set([...state.readNotificationIds, ...action.notificationIds])) };
  }
}

export function serializeMockAppState(state: MockAppState): string { return JSON.stringify(state); }

export function parseMockAppState(value: string | null): MockAppState {
  if (!value) return defaultMockAppState();
  try {
    const candidate = JSON.parse(value) as Record<string, unknown>;
    if (candidate.version === 1 || candidate.version === 2 || candidate.version === 3 || candidate.version === 4) return migrateLegacy(candidate);
    if (candidate.version !== 5) return defaultMockAppState();
    return {
      version: 5,
      readNotificationIds: strings(candidate.readNotificationIds),
    };
  } catch { return defaultMockAppState(); }
}

function migrateLegacy(candidate: Record<string, unknown>): MockAppState {
  return {
    ...defaultMockAppState(),
    readNotificationIds: strings(candidate.readNotificationIds),
  };
}

function addUnique(values: string[], value: string): string[] { return values.includes(value) ? values : [...values, value]; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
