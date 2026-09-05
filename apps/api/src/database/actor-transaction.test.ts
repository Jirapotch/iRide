import { describe, expect, it, vi } from "vitest";

import { withActorTransaction } from "./actor-transaction";

describe("withActorTransaction", () => {
  it("sets authenticated role and JWT claims transaction-locally", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const manager = { query };
    const transaction = vi.fn(async (work: (value: typeof manager) => Promise<string>) => work(manager));

    const result = await withActorTransaction(
      { transaction } as never,
      { role: "authenticated", userId: "11111111-1111-4111-8111-111111111111" },
      async () => "ok",
    );

    expect(result).toBe("ok");
    expect(query).toHaveBeenNthCalledWith(1, "select set_config('role', $1, true)", ["authenticated"]);
    expect(query).toHaveBeenNthCalledWith(2, "select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: "11111111-1111-4111-8111-111111111111", role: "authenticated" }),
    ]);
  });

  it("does not invent a subject for anonymous requests", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const manager = { query };
    const transaction = vi.fn(async (work: (value: typeof manager) => Promise<void>) => work(manager));

    await withActorTransaction({ transaction } as never, { role: "anon" }, async () => undefined);

    expect(query).toHaveBeenNthCalledWith(2, "select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role: "anon" }),
    ]);
  });
});
