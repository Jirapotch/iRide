import { describe, expect, it } from "vitest";

import { themeChanged } from "../features/preferences/preferences.slice";
import { makeStore } from "./make-store";

describe("App Router Redux store", () => {
  it("creates an isolated store for every request", () => {
    const first = makeStore();
    const second = makeStore();

    first.dispatch(themeChanged("dark"));

    expect(first.getState().preferences.theme).toBe("dark");
    expect(second.getState().preferences.theme).toBe("light");
    expect(first).not.toBe(second);
  });
});
