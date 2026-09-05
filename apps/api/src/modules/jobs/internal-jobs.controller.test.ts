import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InternalJobsController } from "./internal-jobs.controller";
import { JobDrainService } from "./job-drain.service";

describe("internal job drain endpoint", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function createApp() {
    const drain = vi.fn().mockResolvedValue({ processed: 2, failed: 0, archived: 2 });
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalJobsController],
      providers: [{ provide: JobDrainService, useValue: { drain } }],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return { app, drain };
  }

  it.each([undefined, "Bearer wrong-secret"])(
    "rejects a missing or invalid cron secret",
    async (authorization) => {
      vi.stubEnv("WORKER_CRON_SECRET", "a-secure-worker-cron-secret");
      const { app, drain } = await createApp();
      const pending = request(app.getHttpServer()).post("/api/internal/jobs/drain");
      if (authorization) pending.set("Authorization", authorization);

      const response = await pending;
      await app.close();

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: { code: "INVALID_CRON_SECRET", message: "Cron authentication failed." },
      });
      expect(drain).not.toHaveBeenCalled();
    },
  );

  it("drains a bounded batch without browser CORS", async () => {
    vi.stubEnv("WORKER_CRON_SECRET", "a-secure-worker-cron-secret");
    const { app, drain } = await createApp();

    const response = await request(app.getHttpServer())
      .post("/api/internal/jobs/drain")
      .set("Authorization", "Bearer a-secure-worker-cron-secret")
      .set("Origin", "https://iride.example");
    await app.close();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { processed: 2, failed: 0, archived: 2 },
    });
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(drain).toHaveBeenCalledWith({ deadlineMs: 45_000, batchSizePerQueue: 2 });
  });
});
