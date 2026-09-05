import type { EntityManager } from "typeorm";
import { describe, expect, it, vi } from "vitest";

import { TypeOrmProfileRepository } from "./typeorm-profile.repository";

function setup(queryResults: unknown[][]) {
  const query = vi.fn();
  for (const result of queryResults) query.mockResolvedValueOnce(result);
  const manager = { query } as unknown as EntityManager;
  const database = {
    transaction: vi.fn(async (work: (value: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  return {
    query,
    repository: new TypeOrmProfileRepository(database as never),
  };
}

describe("TypeOrmProfileRepository", () => {
  it("reads through a service-role transaction", async () => {
    const row = { id: "user-1", username: "road_rider" };
    const { query, repository } = setup([[], [], [row]]);

    await expect(repository.getById("user-1")).resolves.toBe(row);
    expect(query).toHaveBeenNthCalledWith(
      1,
      "select set_config('role', $1, true)",
      ["service_role"],
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("from public.profiles"),
      ["user-1"],
    );
  });

  it("writes normalized fields as the authenticated actor", async () => {
    const { query, repository } = setup([[], [], []]);

    await repository.updateOwner("user-1", "browser-token-is-unused", {
      displayName: "Rider",
      bio: null,
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      "select set_config('role', $1, true)",
      ["authenticated"],
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      "update public.profiles set display_name = $1, bio = $2 where id = $3",
      ["Rider", null, "user-1"],
    );
  });

  it("rejects profile media that the actor does not own", async () => {
    const { repository } = setup([[], [], []]);

    await expect(
      repository.updateOwner("user-1", "token", {
        avatarMediaId: "media-1",
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
