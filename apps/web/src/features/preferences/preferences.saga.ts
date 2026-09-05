import { takeEvery } from "redux-saga/effects";

import { themeChanged } from "./preferences.slice";

function persistTheme(action: ReturnType<typeof themeChanged>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("iride-theme", action.payload);
  document.documentElement.dataset.theme = action.payload;
  document.documentElement.style.colorScheme = action.payload;
}

export function* preferencesSaga() {
  yield takeEvery(themeChanged.type, persistTheme);
}
