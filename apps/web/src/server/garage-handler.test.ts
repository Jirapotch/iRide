import { describe, expect, it, vi } from "vitest";
import { handleGarage } from "./garage-handler";
import type { GarageRepository } from "./repository";
import type { PhotoService } from "./photo-service";
const id = "6d34bc84-8116-4ee5-b6db-c9204b90139b";
describe("public Garage API boundary", () => {
  it("does not call the database for invalid identifiers or fields", async () => {
    const saveVehicle = vi.fn();
    const repo = { saveVehicle } as unknown as GarageRepository;
    const request = new Request("https://iride.test/api/garage/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Car", ownerId: "spoof" }),
    });
    expect(
      (await handleGarage(request, ["vehicles"], repo, {} as PhotoService))
        .status,
    ).toBe(400);
    expect(saveVehicle).not.toHaveBeenCalled();
    expect(
      (
        await handleGarage(
          new Request("https://iride.test/"),
          ["vehicles", "../secret"],
          repo,
          {} as PhotoService,
        )
      ).status,
    ).toBe(400);
  });
  it("accepts vehicle creation without any cookie, token or account", async () => {
    const saveVehicle = vi
      .fn()
      .mockImplementation((input) => ({ ...input, id }));
    const response = await handleGarage(
      new Request("https://iride.test/api/garage/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"name":"My ride"}',
      }),
      ["vehicles"],
      { saveVehicle } as unknown as GarageRepository,
      {} as PhotoService,
    );
    expect(response.status).toBe(201);
    expect((await response.json()).name).toBe("My ride");
  });
  it("does not leak database or Google credentials in unexpected errors", async () => {
    const response = await handleGarage(
      new Request("https://iride.test/"),
      ["vehicles"],
      {
        vehicles: vi.fn().mockRejectedValue(new Error("secret-token")),
      } as unknown as GarageRepository,
      {} as PhotoService,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-token");
  });
  it("rejects oversized upload bodies before parsing multipart or calling Drive", async () => {
    const upload = vi.fn();
    const response = await handleGarage(
      new Request("https://iride.test/", {
        method: "POST",
        body: new Uint8Array(4_024_001),
      }),
      ["vehicles", id, "photos"],
      {} as GarageRepository,
      { upload } as unknown as PhotoService,
    );
    expect(response.status).toBe(413);
    expect(upload).not.toHaveBeenCalled();
  });
});
