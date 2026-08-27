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
const e2eEnvironment = {
  ...process.env,
  CORS_ALLOWED_ORIGINS: "http://127.0.0.1:3000",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:3001",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: MOCK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: MOCK_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: MOCK_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
  SUPABASE_URL: MOCK_SUPABASE_URL,
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

    servers = [
      { app: "web", port: 3000 },
      { app: "api", port: 3001 },
    ].map(({ app, port }) =>
      spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "start",
          "--hostname",
          "0.0.0.0",
          "--port",
          String(port),
        ],
        {
          cwd: path.join(repositoryRoot, "apps", app),
          env: e2eEnvironment,
          stdio: "inherit",
        },
      ),
    );

    await Promise.all([
      waitForHealth("http://127.0.0.1:3000/api/health"),
      waitForHealth("http://127.0.0.1:3001/api/health"),
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
