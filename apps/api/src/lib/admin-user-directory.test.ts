import { describe, expect, it, vi } from "vitest";

import {
  enrichAdminUsersWithEmails,
  loadAllAuthUsers,
  searchAdminUserDirectory,
} from "./admin-user-directory";

const profiles = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    username: "early_rider",
    displayName: "Early Rider",
    createdAt: "2026-08-27T00:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    username: "road_rider",
    displayName: "Road Rider",
    createdAt: "2026-08-29T00:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    username: "city_rider",
    displayName: "City Rider",
    createdAt: "2026-08-28T00:00:00.000Z",
  },
] as const;

const access = profiles.map((profile) => ({
  userId: profile.id,
  role: "user" as const,
  status: "active" as const,
  updatedAt: "2026-09-01T00:00:00.000Z",
}));

const authUsers = [
  { id: profiles[0].id, email: "early@example.test" },
  { id: profiles[1].id, email: "road+team@example.test" },
  { id: profiles[2].id, email: "city+team@example.test" },
] as const;

describe("admin user directory", () => {
  it("searches email case-insensitively before sorting and paginating", () => {
    const result = searchAdminUserDirectory({
      profiles,
      access,
      authUsers,
      q: "TEAM@EXAMPLE",
      page: 2,
      pageSize: 1,
    });

    expect(result).toEqual({
      data: [
        {
          id: profiles[2].id,
          username: "city_rider",
          displayName: "City Rider",
          email: "city+team@example.test",
          role: "user",
          status: "active",
          createdAt: "2026-08-28T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      total: 2,
    });
  });

  it("returns a user once when the same query matches name, username, and email", () => {
    const result = searchAdminUserDirectory({
      profiles,
      access,
      authUsers,
      q: "road",
      page: 1,
      pageSize: 25,
    });

    expect(result.data.map((user) => user.id)).toEqual([profiles[1].id]);
    expect(result.total).toBe(1);
  });

  it("loads every Auth page using the reported total", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({
        data: { users: authUsers.slice(0, 2), total: 3 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: authUsers.slice(2), total: 3 },
        error: null,
      });

    await expect(loadAllAuthUsers(listUsers)).resolves.toEqual(authUsers);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 });
  });

  it("enriches an ordinary database page with Auth emails", async () => {
    const getUserById = vi.fn(async (id: string) => ({
      data: { user: authUsers.find((user) => user.id === id) ?? null },
      error: null,
    }));

    const page = searchAdminUserDirectory({
      profiles,
      access,
      authUsers: [],
      q: "",
      page: 1,
      pageSize: 2,
    }).data;

    await expect(enrichAdminUsersWithEmails(page, getUserById)).resolves.toEqual([
      expect.objectContaining({ id: profiles[1].id, email: "road+team@example.test" }),
      expect.objectContaining({ id: profiles[2].id, email: "city+team@example.test" }),
    ]);
  });

  it("keeps the directory available when Auth cannot resolve a seeded user", async () => {
    const page = searchAdminUserDirectory({
      profiles: profiles.slice(0, 1),
      access: access.slice(0, 1),
      authUsers: [],
      q: "",
      page: 1,
      pageSize: 25,
    }).data;

    await expect(enrichAdminUsersWithEmails(page, async () => ({
      data: { user: null },
      error: { name: "AuthApiError", status: 404, code: "user_not_found", message: "User not found" },
    }))).resolves.toEqual([
      expect.objectContaining({ id: profiles[0].id, email: null }),
    ]);
  });
});
