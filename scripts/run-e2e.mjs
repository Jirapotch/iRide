import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  MOCK_PUBLISHABLE_KEY,
  MOCK_SUPABASE_URL,
  startMockSupabaseAuth,
} from "./mock-supabase-auth.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const webPort = Number.parseInt(process.env.E2E_WEB_PORT ?? "3000", 10);
const apiPort = Number.parseInt(process.env.E2E_API_PORT ?? "3001", 10);
const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const e2eEnvironment = {
  ...process.env,
  CORS_ALLOWED_ORIGINS: webOrigin,
  CLOUDFLARE_ACCOUNT_ID: "e2e-cloudflare-account",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  E2E_API_PORT: String(apiPort),
  E2E_WEB_PORT: String(webPort),
  IRIDE_PROFILE_BACKEND: "supabase-compatibility",
  NEXT_PUBLIC_API_URL: apiOrigin,
  NEXT_PUBLIC_APP_URL: webOrigin,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: MOCK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: MOCK_SUPABASE_URL,
  MIGRATION_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  OPN_SECRET_KEY: "e2e-opn-secret",
  OPN_WEBHOOK_SECRET: "e2e-opn-webhook-secret",
  R2_ACCESS_KEY_ID: "e2e-r2-access-key",
  R2_BUCKET: "e2e-r2-bucket",
  R2_SECRET_ACCESS_KEY: "e2e-r2-secret-key",
  SUPABASE_PUBLISHABLE_KEY: MOCK_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
  SUPABASE_URL: MOCK_SUPABASE_URL,
  WORKER_CRON_SECRET: "e2e-worker-cron-secret",
};

async function waitForHealth(url) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;

  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((resolve) => globalThis.setTimeout(resolve, 2_000)),
  ]);

  if (child.exitCode === null) child.kill("SIGKILL");
}

async function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    env: e2eEnvironment,
    stdio: "inherit",
    ...options,
  });
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) {
    throw new Error(`${command} exited with code ${String(exitCode)}`);
  }
}

async function run() {
  let authServer;
  let servers = [];
  try {
    authServer = await startMockSupabaseAuth();
    await runCommand(process.execPath, [
      "node_modules/turbo/bin/turbo",
      "run",
      "build",
      "--filter=@iride/web",
      "--filter=@iride/api",
    ]);

    const webServer = spawn(
      process.execPath,
      [
          "node_modules/next/dist/bin/next",
          "start",
          "--hostname",
          "0.0.0.0",
          "--port",
          String(webPort),
      ],
      {
        cwd: path.join(repositoryRoot, "apps", "web"),
        env: e2eEnvironment,
        stdio: "inherit",
      },
    );
    const apiServer = spawn(process.execPath, ["dist/main.js"], {
      cwd: path.join(repositoryRoot, "apps", "api"),
      env: { ...e2eEnvironment, PORT: String(apiPort) },
      stdio: "inherit",
    });
    servers = [webServer, apiServer];

    await Promise.all([
      waitForHealth(`${webOrigin}/api/health`),
      waitForHealth(`${apiOrigin}/api/health`),
    ]);

    const playwright = spawn(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test"],
      { cwd: repositoryRoot, env: e2eEnvironment, stdio: "inherit" },
    );
    const [exitCode] = await once(playwright, "exit");
    process.exitCode = typeof exitCode === "number" ? exitCode : 1;
  } finally {
    await Promise.all(servers.map(stopProcessTree));
    if (authServer) {
      await new Promise((resolve, reject) =>
        authServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
}

await run();
