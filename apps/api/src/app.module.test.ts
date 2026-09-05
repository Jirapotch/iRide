import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module";

describe("Nest API compatibility shell", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
    vi.unstubAllEnvs();
  });

  it("preserves the existing health contract", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();

    const response = await request(app.getHttpServer()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: "api",
      status: "ok",
      version: "0.1.0",
    });
  });

  it("preserves authentication errors on versioned routes", async () => {
    vi.stubEnv("SUPABASE_URL", "https://foundation.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Origin", "http://localhost:3000");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required.",
      },
    });
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("routes profiles through the Nest profile module", async () => {
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();

    const response = await request(app.getHttpServer())
      .options("/api/v1/profile/me")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "PATCH");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET, PATCH, OPTIONS",
    );
  });
});
