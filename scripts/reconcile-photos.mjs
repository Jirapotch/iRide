import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
const apply = process.argv.includes("--apply");
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !process.env.GOOGLE_DRIVE_REFRESH_TOKEN)
  throw new Error("Configure database and Drive credentials first.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
    client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
  signal: AbortSignal.timeout(20000),
});
if (!tokenResponse.ok)
  throw new Error("Reconnect Drive before reconciliation.");
const token = (await tokenResponse.json()).access_token,
  headers = { Authorization: "Bearer " + token };
const { data: pending, error } = await db
  .from("garage_vehicle_photos")
  .select("*")
  .eq("status", "uploading")
  .lt("created_at", new Date(Date.now() - 30 * 60000).toISOString());
if (error) throw new Error("Cannot read pending photos.");
const report = [];
for (const photo of pending) {
  const query =
    "trashed = false and appProperties has { key='iride' and value='garage-v1' } and appProperties has { key='photoId' and value='" +
    photo.id +
    "' }";
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent(query) +
      "&fields=files(id,parents,appProperties)&pageSize=100",
    { headers, signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok)
    throw new Error(
      "Cannot inspect Drive upload; no mutation performed for this photo.",
    );
  const files = (await response.json()).files;
  report.push({
    photoId: photo.id,
    vehicleId: photo.vehicle_id,
    driveFileIds: files.map((f) => f.id),
    action: "trash stale upload and remove reservation",
  });
  if (!apply) continue;
  for (const file of files) {
    if (
      file.appProperties?.vehicleId !== photo.vehicle_id ||
      !file.parents?.[0]
    )
      throw new Error("Drive ownership mismatch.");
    const folderResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files/" +
        file.parents[0] +
        "?fields=parents,appProperties",
      { headers },
    );
    if (!folderResponse.ok) throw new Error("Cannot verify parent folder.");
    const folder = await folderResponse.json();
    if (
      !folder.parents?.includes(
        process.env.GOOGLE_DRIVE_FOLDER_ID ??
          "1mFCIBIJHkQjYn4y_gg0GRkiELEatHMf0",
      ) ||
      folder.appProperties?.vehicleId !== photo.vehicle_id
    )
      throw new Error("File outside managed vehicle folder.");
    const deletion = await fetch(
      "https://www.googleapis.com/drive/v3/files/" + file.id,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: '{"trashed":true}',
      },
    );
    if (!deletion.ok)
      throw new Error("Drive cleanup failed; reservation retained.");
  }
  const { error: removeError } = await db.rpc("remove_vehicle_photo", {
    p_photo_id: photo.id,
  });
  if (removeError)
    throw new Error("Database cleanup failed; retry reconciliation.");
}
await mkdir(".tmp", { recursive: true });
await writeFile(
  ".tmp/photo-reconciliation.json",
  JSON.stringify(report, null, 2),
);
console.log(
  (apply ? "Reconciled " : "Dry run: ") +
    report.length +
    " stale uploads. Report: .tmp/photo-reconciliation.json",
);
