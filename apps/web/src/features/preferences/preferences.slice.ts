import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AppTheme = "light" | "dark";

export interface PreferencesState {
  readonly theme: AppTheme;
}

const initialState: PreferencesState = { theme: "light" };

const preferencesSlice = createSlice({
  name: "preferences",
  initialState,
  reducers: {
    themeChanged(state, action: PayloadAction<AppTheme>) {
      state.theme = action.payload;
    },
  },
});

export const { themeChanged } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;
