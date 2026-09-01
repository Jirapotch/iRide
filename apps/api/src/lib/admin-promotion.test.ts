import { describe, expect, it, vi } from "vitest";

import { promoteWithSaga } from "../../../../scripts/admin-promotion.mjs";

const userId = "22222222-2222-4222-8222-222222222222";
const token = "33333333-3333-4333-8333-333333333333";

function setup() {
  return {
    begin: vi.fn().mockResolvedValue({ token, previousStatus: "suspended" }),
    finalize: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue({ role: "admin", status: "active", transitionId: null, action: null }),
    setBan: vi.fn().mockResolvedValue(undefined),
  };
}

describe("promotion saga", () => {
  it("accepts finalize-committed response uncertainty only after reconciling Auth to confirmed DB state", async () => {
    const adapter = setup();
    adapter.finalize.mockRejectedValue(new Error("response lost"));

    const result = await promoteWithSaga(adapter, userId);

    expect(result).toMatchObject({ role: "admin", status: "active", transitionId: null });
    expect(adapter.getState).toHaveBeenCalledWith(userId);
    expect(adapter.setBan).toHaveBeenLastCalledWith(userId, "none");
  });

  it("continues only the same tokenized pending promotion after begin outcome uncertainty", async () => {
    const adapter = setup();
    adapter.begin.mockRejectedValue(new Error("response lost"));
    adapter.getState
      .mockResolvedValueOnce({ role: "admin", status: "active", transitionId: token, action: "promote" })
      .mockResolvedValueOnce({ role: "admin", status: "active", transitionId: null, action: null });

    await promoteWithSaga(adapter, userId);

    expect(adapter.finalize).toHaveBeenCalledWith({ userId, token });
  });
});
