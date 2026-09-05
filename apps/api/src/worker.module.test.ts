import { Test } from "@nestjs/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { WorkerModule } from "./worker.module";

describe("continuous worker process", () => {
  it("preserves the worker health contract", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider("WORKER_RUNNER_ENABLED")
      .useValue(false)
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer()).get("/health");
    await app.close();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: "worker",
      status: "ok",
      version: "0.1.0",
    });
  });
});
