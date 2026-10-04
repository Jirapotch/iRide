import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { Buffer } from "node:buffer";
import process from "node:process";
import {
  MOCK_PUBLISHABLE_KEY,
  MOCK_SUPABASE_URL,
  MOCK_USER_ID,
  startMockSupabaseAuth,
} from "./mock-supabase-auth.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPort = process.env.E2E_WEB_PORT ?? "3100";
const apiPort = process.env.E2E_API_PORT ?? "3101";
const now = "2026-10-04T00:00:00Z";
let profile = {
  id: MOCK_USER_ID,
  username: "e2e_rider",
  displayName: "E2E Rider",
  bio: "Weekend rides",
  avatarMediaId: null,
  coverMediaId: null,
  locationName: "Bangkok",
  latitude: null,
  longitude: null,
  visibility: "public",
  role: "user",
  status: "active",
  canWrite: true,
  canManage: false,
  isComplete: true,
  usernameChangeAvailableAt: null,
  createdAt: now,
  updatedAt: now,
};
let profileFailure = false;
let mediaRequests = [];
let completedImages = 0;
const documentMediaId = "44444444-4444-4444-8444-444444444444";
const api = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${apiPort}`);
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  const input = raw ? JSON.parse(raw) : {};
  const send = (data, status = 200) => {
    response.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(data));
  };
  if (url.pathname === "/test/profile-error") {
    profileFailure = Boolean(input.fail);
    return send({ data: true });
  }
  if (url.pathname === "/test/media-requests") {
    if (request.method === "POST") {
      mediaRequests = [];
      completedImages = 0;
    }
    return send({ data: { requests: mediaRequests, completedImages } });
  }
  if (url.pathname === "/api/v1/media/uploads") {
    mediaRequests.push(input);
    return send({
      data: {
        mediaId: documentMediaId,
        bucketId: "media-originals",
        objectPath: `users/${MOCK_USER_ID}/vehicle_document/${documentMediaId}/original`,
        uploadToken: "test-upload",
        expiresAt: "2099-01-01T00:00:00Z",
      },
    });
  }
  if (url.pathname === `/api/v1/media/${documentMediaId}/complete`) {
    completedImages += 1;
    return send({
      data: {
        mediaId: documentMediaId,
        status: completedImages === 1 ? "processing" : "ready",
      },
    });
  }
  if (url.pathname === "/api/v1/profile/me") {
    if (request.method === "PATCH") {
      if (profileFailure)
        return send({ error: { code: "PROFILE_UPDATE_FAILED" } }, 503);
      profile = { ...profile, ...input, updatedAt: new Date().toISOString() };
    }
    return send({ data: profile });
  }
  if (
    url.pathname.startsWith("/api/v1/users/") &&
    !url.pathname.endsWith("/garage") &&
    !url.pathname.endsWith("/activities")
  )
    return send({
      data: {
        ...profile,
        id: "22222222-2222-4222-8222-222222222222",
        username: "other_rider",
        displayName: "Other Rider",
      },
    });
  return send({ data: [] });
});
let auth;
let web;
const env = {
  ...process.env,
  E2E_WEB_PORT: webPort,
  E2E_API_PORT: apiPort,
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
  API_URL: `http://127.0.0.1:${apiPort}`,
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${webPort}`,
  NEXT_PUBLIC_SUPABASE_URL: MOCK_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: MOCK_PUBLISHABLE_KEY,
  IRIDE_NEXT_DIST_DIR: "node_modules/.cache/iride-profile-next",
};
try {
  auth = await startMockSupabaseAuth();
  await new Promise((resolve) =>
    api.listen(Number(apiPort), "127.0.0.1", resolve),
  );
  web = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      webPort,
    ],
    { cwd: path.join(root, "apps", "web"), env, stdio: "inherit" },
  );
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      if ((await globalThis.fetch(`http://127.0.0.1:${webPort}/api/health`)).ok)
        break;
    } catch {
      /* dev server starts asynchronously */
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 500));
  }
  const keepServer = process.argv.includes("--keep-server");
  const args = process.argv
    .slice(2)
    .filter((argument) => argument !== "--keep-server");
  const child = spawn(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/e2e/profile-garage.spec.ts",
      ...args,
    ],
    { cwd: root, env, stdio: "inherit" },
  );
  const [exitCode] = await once(child, "exit");
  process.exitCode = exitCode ?? 1;
  if (keepServer)
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
} finally {
  web?.kill();
  await Promise.all([
    new Promise((resolve) => api.close(resolve)),
    auth ? new Promise((resolve) => auth.close(resolve)) : Promise.resolve(),
  ]);
}
