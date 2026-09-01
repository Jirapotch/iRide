import { AuthenticationError } from "@iride/auth";
import { describe, expect, it, vi } from "vitest";

import {
  handleAdminUser,
  handleAdminUsers,
  type AdminUsersDependencies,
  type AdminUsersRepository,
} from "./admin-users";

const adminId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: targetId,
    username: "road_rider",
    displayName: "Road Rider",
    email: "rider@example.test",
    role: "user" as const,
    status: "active" as const,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

function setup() {
  const repository = {
    getAccess: vi.fn().mockResolvedValue({ role: "admin", status: "active", transitionId: null }),
    listUsers: vi.fn().mockResolvedValue({ data: [user()], total: 1 }),
    getUser: vi.fn().mockResolvedValue(user()),
    listContent: vi.fn().mockResolvedValue([{ id: "post-1", kind: "post", title: "Hidden post", communityCategory: "groups" }]),
    rollbackTransition: vi.fn().mockResolvedValue(undefined),
    getPendingTransition: vi.fn().mockResolvedValue({ token: "33333333-3333-4333-8333-333333333333", action: "restore", previousStatus: "suspended", status: "active" }),
    getAccountState: vi.fn().mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z", transitionId: null, action: null, previousStatus: null, actorId: null }),
    recoverStaleTransition: vi.fn().mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z" }),
    beginTransition: vi.fn().mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z", token: "33333333-3333-4333-8333-333333333333", previousStatus: "active" }),
    finalizeTransition: vi.fn().mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z" }),
    updateBan: vi.fn().mockResolvedValue(undefined),
    audit: vi.fn().mockResolvedValue(undefined),
  } as AdminUsersRepository & {
    rollbackTransition: ReturnType<typeof vi.fn>;
    getPendingTransition: ReturnType<typeof vi.fn>;
    getAccountState: ReturnType<typeof vi.fn>;
    recoverStaleTransition: ReturnType<typeof vi.fn>;
    beginTransition: ReturnType<typeof vi.fn>;
    finalizeTransition: ReturnType<typeof vi.fn>;
  };
  const dependencies: AdminUsersDependencies = {
    authenticate: vi.fn().mockResolvedValue({ userId: adminId, accessTokenClaims: {} }),
    repository,
    allowedOrigins: "http://localhost:3000",
  };
  return { dependencies, repository };
}

describe("admin users API handlers", () => {
  it("returns suspended user content only through the authenticated admin detail", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.getUser).mockResolvedValue(user({ status: "suspended" }));
    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, { headers: { authorization: "Bearer signed.jwt" } }),
      targetId,
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: "suspended", content: [{ id: "post-1", kind: "post" }] } });
    expect(repository.listContent).toHaveBeenCalledWith(targetId);
  });
  it("requires an active admin account", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.getAccess).mockResolvedValue({ role: "admin", status: "locked", transitionId: null });

    const response = await handleAdminUsers(
      new Request("http://localhost:3001/api/v1/admin/users", {
        headers: { authorization: "Bearer signed.jwt" },
      }),
      dependencies,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "ADMIN_FORBIDDEN" } });
  });

  it("does not let a pending restore confer admin access", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.getAccess).mockResolvedValue({
      role: "admin",
      status: "active",
      transitionId: "33333333-3333-4333-8333-333333333333",
    });

    const response = await handleAdminUsers(
      new Request("http://localhost:3001/api/v1/admin/users", {
        headers: { authorization: "Bearer signed.jwt" },
      }),
      dependencies,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "ADMIN_FORBIDDEN" } });
  });

  it("returns a bounded searched page for an active admin", async () => {
    const { dependencies, repository } = setup();
    const response = await handleAdminUsers(
      new Request("http://localhost:3001/api/v1/admin/users?q=%20rider%20&page=2", {
        headers: { authorization: "Bearer signed.jwt" },
      }),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [user()],
      page: 2,
      pageSize: 25,
      total: 1,
    });
    expect(repository.listUsers).toHaveBeenCalledWith({ q: "rider", page: 2, pageSize: 25 });
  });

  it("rejects self suspension and locking the last active admin before mutation", async () => {
    const self = setup();
    const selfResponse = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${adminId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      }),
      adminId,
      self.dependencies,
    );
    expect(selfResponse.status).toBe(403);
    expect(self.repository.beginTransition).not.toHaveBeenCalled();

    const last = setup();
    vi.mocked(last.repository.getUser).mockResolvedValue(user({ id: targetId, role: "admin" }));
    vi.mocked(last.repository.beginTransition).mockRejectedValue(new Error("last_active_admin"));
    const lastResponse = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "lock" }),
      }),
      targetId,
      last.dependencies,
    );
    expect(lastResponse.status).toBe(409);
    expect(last.repository.beginTransition).toHaveBeenCalledWith({ adminId, targetId, action: "lock" });
  });

  it("retries an outcome-unknown Auth update against the current matching token", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.updateBan).mockRejectedValueOnce(new Error("Auth outcome unknown"));
    vi.mocked(repository.getAccountState).mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z", transitionId: "33333333-3333-4333-8333-333333333333", action: "suspend", previousStatus: "active", actorId: adminId });
    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(repository.getAccountState).toHaveBeenCalledWith(targetId);
    expect(repository.finalizeTransition).toHaveBeenCalledWith({ adminId, targetId, token: "33333333-3333-4333-8333-333333333333" });
  });

  it("returns a conflict when the transactional transition rejects the current state", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.beginTransition).mockRejectedValue(new Error("invalid_transition"));

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "ADMIN_INVALID_TRANSITION" } });
  });

  it("continues only its matching pending transition after begin response uncertainty", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.beginTransition).mockRejectedValue(new Error("response lost"));
    vi.mocked(repository.getAccountState).mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z", transitionId: "33333333-3333-4333-8333-333333333333", action: "suspend", previousStatus: "active", actorId: adminId });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(repository.finalizeTransition).toHaveBeenCalledWith({ adminId, targetId, token: "33333333-3333-4333-8333-333333333333" });
  });

  it("reconciles a pending restore begun before an outcome-unknown begin response", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.beginTransition).mockRejectedValue(new Error("begin response lost"));
    vi.mocked(repository.finalizeTransition).mockResolvedValue({ role: "user", status: "suspended", updatedAt: "stale-finalize-response" });
    vi.mocked(repository.getAccountState)
      .mockResolvedValueOnce({ role: "user", status: "active", updatedAt: "pending-restore", transitionId: "33333333-3333-4333-8333-333333333333", action: "restore", previousStatus: "suspended", actorId: adminId })
      .mockResolvedValueOnce({ role: "user", status: "active", updatedAt: "restored", transitionId: null, action: null, previousStatus: null, actorId: null });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "active", updatedAt: "restored" });
    expect(repository.updateBan).toHaveBeenLastCalledWith(targetId, "none");
  });

  it("reconciles Auth after an outcome-unknown restore Auth update", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.beginTransition).mockResolvedValue({ role: "user", status: "active", updatedAt: "pending-restore", token: "33333333-3333-4333-8333-333333333333", previousStatus: "suspended" });
    vi.mocked(repository.updateBan).mockRejectedValueOnce(new Error("Auth response lost"));
    vi.mocked(repository.finalizeTransition).mockResolvedValue({ role: "user", status: "suspended", updatedAt: "stale-finalize-response" });
    vi.mocked(repository.getAccountState)
      .mockResolvedValueOnce({ role: "user", status: "active", updatedAt: "pending-restore", transitionId: "33333333-3333-4333-8333-333333333333", action: "restore", previousStatus: "suspended", actorId: adminId })
      .mockResolvedValueOnce({ role: "user", status: "active", updatedAt: "restored", transitionId: null, action: null, previousStatus: null, actorId: null });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "active", updatedAt: "restored" });
    expect(repository.updateBan).toHaveBeenLastCalledWith(targetId, "none");
  });

  it("rejects a concurrent transition for the same target", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.beginTransition).mockRejectedValue(new Error("transition_in_progress"));

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "ADMIN_TRANSITION_IN_PROGRESS" } });
  });

  it("returns a committed transition after a finalize response is outcome-unknown", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.finalizeTransition).mockRejectedValue(new Error("transition_token_mismatch"));
    vi.mocked(repository.getAccountState).mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z", transitionId: null, action: null, previousStatus: null, actorId: null });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "suspended" });
    expect(repository.getAccountState).toHaveBeenCalledWith(targetId);
  });

  it("retries a matching pending finalize after its response is outcome-unknown", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.finalizeTransition)
      .mockRejectedValueOnce(new Error("transport outcome unknown"))
      .mockResolvedValueOnce({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z" });
    vi.mocked(repository.getAccountState).mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z", transitionId: "33333333-3333-4333-8333-333333333333", action: "suspend", previousStatus: "active", actorId: adminId });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(repository.finalizeTransition).toHaveBeenCalledTimes(2);
  });

  it("reconciles an unlock after a finalize error before commit succeeds on retry", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.beginTransition).mockResolvedValue({ role: "user", status: "active", updatedAt: "pending-unlock", token: "33333333-3333-4333-8333-333333333333", previousStatus: "locked" });
    vi.mocked(repository.finalizeTransition)
      .mockRejectedValueOnce(new Error("database timeout before commit"))
      .mockResolvedValueOnce({ role: "user", status: "locked", updatedAt: "stale-finalize-response" });
    vi.mocked(repository.getAccountState)
      .mockResolvedValueOnce({ role: "user", status: "active", updatedAt: "pending-unlock", transitionId: "33333333-3333-4333-8333-333333333333", action: "unlock", previousStatus: "locked", actorId: adminId })
      .mockResolvedValueOnce({ role: "user", status: "active", updatedAt: "unlocked", transitionId: null, action: null, previousStatus: null, actorId: null });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "unlock" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "active", updatedAt: "unlocked" });
    expect(repository.updateBan).toHaveBeenLastCalledWith(targetId, "none");
  });

  it("returns the reconciled restore state when finalization committed before its response failed", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.beginTransition).mockResolvedValue({ role: "user", status: "active", updatedAt: "pending-restore", token: "33333333-3333-4333-8333-333333333333", previousStatus: "suspended" });
    vi.mocked(repository.finalizeTransition).mockRejectedValue(new Error("finalize response lost"));
    vi.mocked(repository.getAccountState).mockResolvedValue({ role: "user", status: "active", updatedAt: "restored", transitionId: null, action: null, previousStatus: null, actorId: null });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "active", updatedAt: "restored" });
    expect(repository.updateBan).toHaveBeenLastCalledWith(targetId, "none");
  });

  it("surfaces an explicit consistency failure when Auth-ban compensation cannot be audited", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.updateBan).mockRejectedValue(new Error("Auth unavailable"));
    vi.mocked(repository.rollbackTransition).mockRejectedValue(new Error("rollback failed"));

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "ADMIN_CONSISTENCY_ERROR" } });
  });

  it("reconciles a stale pending restore to its prior Auth and database state", async () => {
    const { dependencies, repository } = setup();
    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "recover" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(repository.updateBan).toHaveBeenCalledWith(targetId, "876000h");
    expect(repository.recoverStaleTransition).toHaveBeenCalledWith({ adminId, targetId, token: "33333333-3333-4333-8333-333333333333" });
    expect((await response.json()).data).toMatchObject({ status: "suspended" });
  });

  it("uses post-race database state rather than a stale recovery snapshot", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.recoverStaleTransition).mockRejectedValue(new Error("transition_token_mismatch"));
    vi.mocked(repository.getAccountState).mockResolvedValue({ role: "user", status: "suspended", updatedAt: "2026-09-01T00:00:00.000Z", transitionId: null, action: null, previousStatus: null, actorId: null });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "recover" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(repository.updateBan).toHaveBeenLastCalledWith(targetId, "876000h");
    expect(repository.getAccountState).toHaveBeenCalledWith(targetId);
  });

  it("rereads and reconciles after a recovery retry succeeds following an uncommitted error", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.recoverStaleTransition)
      .mockRejectedValueOnce(new Error("database timeout before commit"))
      .mockResolvedValueOnce({ role: "user", status: "active", updatedAt: "stale-rpc-response" });
    vi.mocked(repository.getAccountState)
      .mockResolvedValueOnce({ role: "user", status: "active", updatedAt: "pending", transitionId: "33333333-3333-4333-8333-333333333333", action: "restore", previousStatus: "suspended", actorId: adminId })
      .mockResolvedValueOnce({ role: "user", status: "suspended", updatedAt: "recovered", transitionId: null, action: null, previousStatus: null, actorId: null });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "recover" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "suspended", updatedAt: "recovered" });
    expect(repository.updateBan).toHaveBeenLastCalledWith(targetId, "876000h");
  });

  it("uses the current state when a stale original recovery interleaves after the RPC succeeds", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.recoverStaleTransition).mockResolvedValue({ role: "user", status: "suspended", updatedAt: "stale-rpc-response" });
    vi.mocked(repository.getAccountState).mockResolvedValue({
      role: "user",
      status: "locked",
      updatedAt: "new-pending-lock",
      transitionId: "44444444-4444-4444-8444-444444444444",
      action: "lock",
      previousStatus: "active",
      actorId: adminId,
    });

    const response = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "recover" }),
      }),
      targetId,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "locked", updatedAt: "new-pending-lock" });
    expect(repository.updateBan).toHaveBeenLastCalledWith(targetId, "876000h");
  });

  it("bans suspended users, unbans restored users, and audits successful transitions", async () => {
    const suspended = setup();
    const suspendResponse = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      }),
      targetId,
      suspended.dependencies,
    );
    expect(suspendResponse.status).toBe(200);
    expect((await suspendResponse.json()).data.updatedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(suspended.repository.updateBan).toHaveBeenCalledWith(targetId, "876000h");
    expect(suspended.repository.beginTransition).toHaveBeenCalledWith({ adminId, targetId, action: "suspend" });
    expect(suspended.repository.finalizeTransition).toHaveBeenCalledWith({ adminId, targetId, token: "33333333-3333-4333-8333-333333333333" });

    const restored = setup();
    vi.mocked(restored.repository.getUser).mockResolvedValue(user({ status: "suspended" }));
    const restoreResponse = await handleAdminUser(
      new Request(`http://localhost:3001/api/v1/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      }),
      targetId,
      restored.dependencies,
    );
    expect(restoreResponse.status).toBe(200);
    expect(restored.repository.updateBan).toHaveBeenCalledWith(targetId, "none");
    expect(restored.repository.beginTransition).toHaveBeenCalledWith({ adminId, targetId, action: "restore" });
  });

  it("returns authentication failures without querying administration data", async () => {
    const { dependencies, repository } = setup();
    const response = await handleAdminUsers(
      new Request("http://localhost:3001/api/v1/admin/users"),
      { ...dependencies, authenticate: vi.fn().mockRejectedValue(new AuthenticationError("AUTH_REQUIRED")) },
    );
    expect(response.status).toBe(401);
    expect(repository.getAccess).not.toHaveBeenCalled();
  });
});
