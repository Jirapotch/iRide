import "server-only";
import { GarageError } from "@/features/garage/validation";
import type { PhotoStorage } from "./photo-service";
const API = "https://www.googleapis.com/drive/v3/files";
export const DRIVE_FOLDER_ID = "1mFCIBIJHkQjYn4y_gg0GRkiELEatHMf0";
export class UncertainUploadError extends GarageError {
  constructor() {
    super("UPLOAD_RECONCILE_REQUIRED", 503);
  }
}
interface DriveFile {
  id: string;
  parents?: string[];
  mimeType?: string;
  trashed?: boolean;
  appProperties?: Record<string, string>;
}
export class GoogleDriveStorage implements PhotoStorage {
  private token: { value: string; expires: number } | null = null;
  private root = process.env.GOOGLE_DRIVE_FOLDER_ID ?? DRIVE_FOLDER_ID;
  private async accessToken() {
    if (this.token && this.token.expires > Date.now() + 60000)
      return this.token.value;
    const client = process.env.GOOGLE_DRIVE_CLIENT_ID,
      secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      refresh = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    if (!client || !secret || !refresh)
      throw new GarageError("DRIVE_NOT_CONFIGURED", 503);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: client,
        client_secret: secret,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new GarageError("DRIVE_RECONNECT_REQUIRED", 503);
    const json = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      value: json.access_token,
      expires: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }
  private async request(url: string, options: RequestInit = {}) {
    const token = await this.accessToken();
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(55000),
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 404)
        throw new GarageError("DRIVE_FILE_NOT_FOUND", 404);
      if (response.status === 401) {
        this.token = null;
        throw new GarageError("DRIVE_RECONNECT_REQUIRED", 503);
      }
      if (response.status === 403)
        throw new GarageError("DRIVE_PERMISSION_OR_QUOTA", 503);
      throw new GarageError("DRIVE_UNAVAILABLE", 503);
    }
    return response;
  }
  private async metadata(id: string): Promise<DriveFile> {
    return (
      await this.request(
        API +
          "/" +
          encodeURIComponent(id) +
          "?fields=id,parents,mimeType,trashed,appProperties",
      )
    ).json();
  }
  private async folder(vehicleId: string) {
    const q =
      "'" +
      this.root.replaceAll("'", "\\'") +
      "' in parents and name = '" +
      vehicleId +
      "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='iride' and value='garage-v1' }";
    const data = (await (
      await this.request(
        API + "?q=" + encodeURIComponent(q) + "&fields=files(id)&pageSize=10",
      )
    ).json()) as { files: DriveFile[] };
    if (data.files[0]) return data.files[0].id;
    const root = await this.metadata(this.root);
    if (root.mimeType !== "application/vnd.google-apps.folder" || root.trashed)
      throw new GarageError("DRIVE_FOLDER_UNAVAILABLE", 503);
    const folder = (await (
      await this.request(API + "?fields=id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vehicleId,
          mimeType: "application/vnd.google-apps.folder",
          parents: [this.root],
          appProperties: { iride: "garage-v1", vehicleId },
        }),
      })
    ).json()) as DriveFile;
    return folder.id;
  }
  async upload(
    vehicleId: string,
    photoId: string,
    name: string,
    mime: string,
    bytes: Uint8Array,
  ) {
    const parent = await this.folder(vehicleId);
    const boundary = "iride-" + crypto.randomUUID();
    const metadata = {
      name: name.slice(0, 160),
      parents: [parent],
      appProperties: { iride: "garage-v1", vehicleId, photoId },
    };
    const body = new Blob([
      "--" +
        boundary +
        "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        "\r\n--" +
        boundary +
        "\r\nContent-Type: " +
        mime +
        "\r\n\r\n",
      bytes as Uint8Array<ArrayBuffer>,
      "\r\n--" + boundary + "--",
    ]);
    try {
      const json = (await (
        await this.request(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
          {
            method: "POST",
            headers: {
              "Content-Type": "multipart/related; boundary=" + boundary,
            },
            body,
          },
        )
      ).json()) as DriveFile;
      if (!json.id) throw new UncertainUploadError();
      return json.id;
    } catch (error) {
      if (
        error instanceof GarageError &&
        [
          "DRIVE_PERMISSION_OR_QUOTA",
          "DRIVE_RECONNECT_REQUIRED",
          "DRIVE_NOT_CONFIGURED",
        ].includes(error.code)
      )
        throw error;
      throw new UncertainUploadError();
    }
  }
  private async owned(
    fileId: string,
    vehicleId: string,
    knownFile?: DriveFile,
  ) {
    const file = knownFile ?? (await this.metadata(fileId));
    if (
      file.appProperties?.iride !== "garage-v1" ||
      file.appProperties.vehicleId !== vehicleId ||
      !file.parents?.[0]
    )
      throw new GarageError("DRIVE_FILE_NOT_OWNED", 403);
    const folder = await this.metadata(file.parents[0]);
    if (
      !folder.parents?.includes(this.root) ||
      folder.appProperties?.iride !== "garage-v1" ||
      folder.appProperties?.vehicleId !== vehicleId ||
      folder.mimeType !== "application/vnd.google-apps.folder" ||
      folder.trashed
    )
      throw new GarageError("DRIVE_FILE_NOT_OWNED", 403);
    return file;
  }
  async trash(fileId: string, vehicleId: string) {
    let file: DriveFile;
    try {
      file = await this.metadata(fileId);
    } catch (error) {
      if (error instanceof GarageError && error.code === "DRIVE_FILE_NOT_FOUND")
        return;
      throw error;
    }
    if (file.trashed) return;
    await this.owned(fileId, vehicleId, file);
    await this.request(API + "/" + encodeURIComponent(fileId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  }
  async read(fileId: string, vehicleId: string) {
    const file = await this.owned(fileId, vehicleId);
    if (file.trashed) throw new GarageError("PHOTO_NOT_FOUND", 404);
    return this.request(API + "/" + encodeURIComponent(fileId) + "?alt=media");
  }
}
