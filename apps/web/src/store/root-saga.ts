import { all, fork } from "redux-saga/effects";

import { preferencesSaga } from "../features/preferences/preferences.saga";

export function* rootSaga() {
  yield all([fork(preferencesSaga)]);
}
