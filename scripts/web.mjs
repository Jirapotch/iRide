import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
if (existsSync(".env.drive.local")) process.loadEnvFile(".env.drive.local");
const command = process.argv[2] ?? "dev";
const child = spawn(
  process.execPath,
  [
    resolve("apps/web/node_modules/next/dist/bin/next"),
    command,
    ...(command === "build"
      ? []
      : ["--hostname", "127.0.0.1", "--port", process.env.PORT ?? "3000"]),
  ],
  { cwd: resolve("apps/web"), env: process.env, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));
