"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore } from "./make-store";

export function StoreProvider({ children }: { readonly children: ReactNode }) {
  const [store] = useState(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
