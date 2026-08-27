"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useReducer,
} from "react";

import {
  defaultMockAppState,
  type MockAppAction,
  type MockAppState,
  parseMockAppState,
  reduceMockAppState,
  serializeMockAppState,
} from "@/lib/mock-app-state";

const STORAGE_KEY = "iride-demo-state-v2";
const LEGACY_STORAGE_KEY = "iride-demo-state-v1";

const MockAppContext = createContext<
  { state: MockAppState; dispatch: Dispatch<MockAppAction> } | undefined
>(undefined);

interface ProviderState {
  data: MockAppState;
  hydrated: boolean;
}

function providerReducer(
  state: ProviderState,
  action: MockAppAction,
): ProviderState {
  if (action.type === "hydrate") {
    return { data: action.state, hydrated: true };
  }
  return { ...state, data: reduceMockAppState(state.data, action) };
}

export function MockAppProvider({ children }: { readonly children: ReactNode }) {
  const [store, dispatch] = useReducer(providerReducer, {
    data: defaultMockAppState(),
    hydrated: false,
  });

  useEffect(() => {
    const stored = parseMockAppState(
      window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY),
    );
    dispatch({ type: "hydrate", state: stored });
  }, []);

  useEffect(() => {
    if (!store.hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, serializeMockAppState(store.data));
  }, [store]);

  return (
    <MockAppContext.Provider value={{ state: store.data, dispatch }}>
      {children}
    </MockAppContext.Provider>
  );
}

export function useMockApp() {
  const value = useContext(MockAppContext);
  if (!value) throw new Error("useMockApp must be used inside MockAppProvider");
  return value;
}
