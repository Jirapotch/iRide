"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface MarkerOption {
  readonly kind: "event";
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
}

interface MarkerOptionsValue {
  readonly markerOptions: readonly MarkerOption[];
  readonly markerOptionsUnavailable: boolean;
  readonly setMarkerOptions: (
    options: readonly MarkerOption[],
    unavailable: boolean,
  ) => void;
}

const MarkerOptionsContext = createContext<MarkerOptionsValue | null>(null);

export function CreateMarkerOptionsProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [state, setState] = useState<{
    readonly markerOptions: readonly MarkerOption[];
    readonly markerOptionsUnavailable: boolean;
  }>({ markerOptions: [], markerOptionsUnavailable: false });
  const setMarkerOptions = useCallback(
    (
      markerOptions: readonly MarkerOption[],
      markerOptionsUnavailable: boolean,
    ) => setState({ markerOptions, markerOptionsUnavailable }),
    [],
  );
  const value = useMemo<MarkerOptionsValue>(
    () => ({
      ...state,
      setMarkerOptions,
    }),
    [setMarkerOptions, state],
  );
  return (
    <MarkerOptionsContext.Provider value={value}>
      {children}
    </MarkerOptionsContext.Provider>
  );
}

export function CreateMarkerOptionsHydrator({
  markerOptions,
  unavailable,
}: {
  readonly markerOptions: readonly MarkerOption[];
  readonly unavailable: boolean;
}) {
  const context = useContext(MarkerOptionsContext);
  const setMarkerOptions = context?.setMarkerOptions;
  useEffect(() => {
    setMarkerOptions?.(markerOptions, unavailable);
  }, [markerOptions, setMarkerOptions, unavailable]);
  return null;
}

export function useCreateMarkerOptions() {
  const context = useContext(MarkerOptionsContext);
  if (!context)
    throw new Error(
      "useCreateMarkerOptions must be used within CreateMarkerOptionsProvider",
    );
  return context;
}
