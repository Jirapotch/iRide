import { expect, it, vi } from "vitest";
import type { RideGroupDto } from "@iride/types";
import { handleGroupCollection, handleGroupMembership } from "./groups";

const group: RideGroupDto = {
  id: "c70b21f8-e77f-47ae-bdf8-b2c23604374a",
  slug: "group-c70b21f8",
  name: "Weekend riders",
  description: "",
  creatorId: "user-1",
  memberCount: 1,
  isMember: true,
  members: [],
  createdAt: "2026-09-26T00:00:00Z",
};

it("creates a public group for an authenticated rider", async () => {
  const create = vi.fn(async () => group);
  const dependencies = {
    authenticate: async () => ({ userId: "user-1", accessToken: "token" }),
    repository: {
      list: async () => [group],
      get: async () => group,
      create,
      join: async () => group,
      leave: async () => group,
    },
  };
  const response = await handleGroupCollection(
    new Request("https://example.test/api/v1/groups", {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Weekend riders", description: "" }),
    }),
    dependencies,
  );
  expect(response.status).toBe(201);
  expect((await response.json()).data.slug).toBe(group.slug);
  expect(create).toHaveBeenCalledWith("user-1", "token", {
    name: "Weekend riders",
    description: "",
  });
});

it("lets a rider join an open group immediately", async () => {
  const join = vi.fn(async () => group);
  const response = await handleGroupMembership(
    new Request("https://example.test/api/v1/groups/group-c70b21f8/members", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    }),
    "group-c70b21f8",
    {
      authenticate: async () => ({ userId: "user-1", accessToken: "token" }),
      repository: {
        list: async () => [],
        get: async () => group,
        create: async () => group,
        join,
        leave: async () => group,
      },
    },
  );
  expect(response.status).toBe(200);
  expect(join).toHaveBeenCalledWith("user-1", "token", "group-c70b21f8");
});
