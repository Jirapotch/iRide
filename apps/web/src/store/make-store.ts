import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import { preferencesReducer } from "../features/preferences/preferences.slice";
import { rootSaga } from "./root-saga";

export function makeStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { preferences: preferencesReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(sagaMiddleware),
  });
  sagaMiddleware.run(rootSaga);
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
