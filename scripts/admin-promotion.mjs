const permanentBanDuration = "876000h";

/**
 * Runs the server-only bootstrap-promotion saga. Every failed remote call is
 * treated as outcome-unknown: the account row is re-read, Auth is driven to
 * that confirmed state, and only the matching pending token is retried.
 */
export async function promoteWithSaga(adapter, userId) {
  let transition;
  try {
    transition = await adapter.begin(userId);
  } catch (error) {
    const state = await reconcileAuth(adapter, userId);
    if (state.transitionId && state.action === "promote") {
      transition = { token: state.transitionId, previousStatus: state.status };
    } else {
      throw error;
    }
  }

  try {
    await adapter.setBan(userId, "none");
  } catch (error) {
    const state = await reconcileAuth(adapter, userId);
    if (isFinalPromotion(state)) return state;
    if (state.transitionId !== transition.token || state.action !== "promote") throw error;
    try {
      await adapter.setBan(userId, "none");
    } catch (retryError) {
      await reconcileAuth(adapter, userId);
      throw retryError;
    }
  }

  try {
    await adapter.finalize({ userId, token: transition.token });
    const state = await reconcileAuth(adapter, userId);
    if (isFinalPromotion(state)) return state;
    throw new Error("Promotion finalization did not produce an active admin state.");
  } catch (error) {
    const state = await reconcileAuth(adapter, userId);
    if (isFinalPromotion(state)) return state;
    if (state.transitionId !== transition.token || state.action !== "promote") throw error;
    try {
      await adapter.finalize({ userId, token: transition.token });
    } catch (retryError) {
      const retriedState = await reconcileAuth(adapter, userId);
      if (isFinalPromotion(retriedState)) return retriedState;
      throw retryError;
    }
    const finalizedState = await reconcileAuth(adapter, userId);
    if (isFinalPromotion(finalizedState)) return finalizedState;
    throw new Error("Promotion finalization did not produce an active admin state.");
  }
}

async function reconcileAuth(adapter, userId) {
  let state = await adapter.getState(userId);
  if (!state) throw new Error("Promotion account state is unavailable.");
  try {
    await adapter.setBan(userId, state.status === "suspended" ? permanentBanDuration : "none");
  } catch (error) {
    state = await adapter.getState(userId);
    if (!state) throw new Error("Promotion account state is unavailable.");
    try {
      await adapter.setBan(userId, state.status === "suspended" ? permanentBanDuration : "none");
    } catch {
      await adapter.getState(userId);
      throw error;
    }
  }
  return state;
}

function isFinalPromotion(state) {
  return state.transitionId === null && state.role === "admin" && state.status === "active";
}
