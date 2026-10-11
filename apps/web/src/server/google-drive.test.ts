import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GoogleDriveStorage, DRIVE_FOLDER_ID } from "./google-drive";
const vehicle = "6d34bc84-8116-4ee5-b6db-c9204b90139b";
const owned = {
  id: "photo",
  parents: ["folder"],
  appProperties: { iride: "garage-v1", vehicleId: vehicle },
};
const folder = {
  id: "folder",
  parents: [DRIVE_FOLDER_ID],
  mimeType: "application/vnd.google-apps.folder",
  appProperties: { iride: "garage-v1", vehicleId: vehicle },
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const mockedFetch = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", mockedFetch);
  vi.stubEnv("GOOGLE_DRIVE_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_DRIVE_CLIENT_SECRET", "test-secret");
  vi.stubEnv("GOOGLE_DRIVE_REFRESH_TOKEN", "test-refresh");
  mockedFetch.mockResolvedValueOnce(
    json({ access_token: "test-token", expires_in: 3600 }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it("requires reconnect when the refresh token is revoked", async () => {
  mockedFetch.mockReset().mockResolvedValue(json({}, 400));
  await expect(
    new GoogleDriveStorage().read("photo", vehicle),
  ).rejects.toMatchObject({ code: "DRIVE_RECONNECT_REQUIRED" });
});
it("rejects a Drive file belonging to a different vehicle", async () => {
  mockedFetch.mockResolvedValueOnce(
    json({
      ...owned,
      appProperties: { iride: "garage-v1", vehicleId: "other" },
    }),
  );
  await expect(
    new GoogleDriveStorage().trash("photo", vehicle),
  ).rejects.toMatchObject({ code: "DRIVE_FILE_NOT_OWNED" });
  expect(mockedFetch).toHaveBeenCalledTimes(2);
});
it("retains metadata if the parent cannot be verified", async () => {
  mockedFetch
    .mockResolvedValueOnce(json(owned))
    .mockResolvedValueOnce(json({}, 404));
  await expect(
    new GoogleDriveStorage().trash("photo", vehicle),
  ).rejects.toMatchObject({ code: "DRIVE_FILE_NOT_FOUND" });
  expect(mockedFetch).toHaveBeenCalledTimes(3);
});
it("does not read an arbitrary file outside the configured folder", async () => {
  mockedFetch
    .mockResolvedValueOnce(json(owned))
    .mockResolvedValueOnce(json({ ...folder, parents: ["other-root"] }));
  await expect(
    new GoogleDriveStorage().read("photo", vehicle),
  ).rejects.toMatchObject({ code: "DRIVE_FILE_NOT_OWNED" });
});
it("can retry a photo already missing from Drive", async () => {
  mockedFetch.mockResolvedValueOnce(json({}, 404));
  await expect(
    new GoogleDriveStorage().trash("photo", vehicle),
  ).resolves.toBeUndefined();
});
it("reports full quota without treating it as an ambiguous upload", async () => {
  mockedFetch
    .mockResolvedValueOnce(json({ files: [{ id: "folder" }] }))
    .mockResolvedValueOnce(json({}, 403));
  await expect(
    new GoogleDriveStorage().upload(
      vehicle,
      "id",
      "car.jpg",
      "image/jpeg",
      new Uint8Array([255, 216, 255]),
    ),
  ).rejects.toMatchObject({ code: "DRIVE_PERMISSION_OR_QUOTA" });
});
it("requires reconciliation if upload response is lost", async () => {
  mockedFetch
    .mockResolvedValueOnce(json({ files: [{ id: "folder" }] }))
    .mockRejectedValueOnce(new TypeError("connection reset"));
  await expect(
    new GoogleDriveStorage().upload(
      vehicle,
      "id",
      "car.jpg",
      "image/jpeg",
      new Uint8Array([255, 216, 255]),
    ),
  ).rejects.toMatchObject({ code: "UPLOAD_RECONCILE_REQUIRED" });
});
it("only serves content after checking file and parent ownership", async () => {
  mockedFetch
    .mockResolvedValueOnce(json(owned))
    .mockResolvedValueOnce(json(folder))
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
  await expect(
    new GoogleDriveStorage().read("photo", vehicle),
  ).resolves.toBeInstanceOf(Response);
  expect(String(mockedFetch.mock.calls.at(-1)?.[0])).toContain(
    "photo?alt=media",
  );
});
