import { describe, expect, it, vi } from "vitest";

import {
  handleAdminModeration,
  type AdminModerationDependencies,
} from "./admin-moderation";

const adminId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";

function setup() {
  const repository = {
    getAccess: vi.fn().mockResolvedValue({ role: "admin", status: "active", transitionId: null }),
    moderateDelete: vi.fn().mockResolvedValue(undefined),
  };
  const dependencies: AdminModerationDependencies = {
    authenticate: vi.fn().mockResolvedValue({ userId: adminId, accessTokenClaims: {} }),
    repository,
    allowedOrigins: "http://localhost:3000",
  };
  return { dependencies, repository };
}

describe("admin moderation API", () => {
  it("deletes a resource through the audited server-only moderation operation", async () => {
    const { dependencies, repository } = setup();

    const response = await handleAdminModeration(
      new Request("http://localhost:3001/api/v1/admin/moderation", {
        method: "DELETE",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ id: targetId, kind: "vehicle" }),
      }),
      dependencies,
    );

    expect(response.status).toBe(204);
    expect(repository.moderateDelete).toHaveBeenCalledWith({ actorId: adminId, targetId, kind: "vehicle" });
  });

  it("does not permit a generic owner to invoke an administrative delete or audit", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.getAccess).mockResolvedValue({ role: "user", status: "active", transitionId: null });

    const response = await handleAdminModeration(
      new Request("http://localhost:3001/api/v1/admin/moderation", {
        method: "DELETE",
        headers: { authorization: "Bearer signed.jwt", "content-type": "application/json" },
        body: JSON.stringify({ id: targetId, kind: "post" }),
      }),
      dependencies,
    );

    expect(response.status).toBe(403);
    expect(repository.moderateDelete).not.toHaveBeenCalled();
  });
});
