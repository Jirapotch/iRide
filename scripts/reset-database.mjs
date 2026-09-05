import { spawnSync } from "node:child_process";
import process from "node:process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

run(["exec", "supabase", "db", "reset", "--local", "--no-seed"]);
run(["--filter", "@iride/api", "db:migrate:run"]);
run(["exec", "supabase", "db", "query", "--local", "--file", "supabase/seed.sql"]);
run(["exec", "supabase", "test", "db", "--local"]);

function run(args) {
  const result = spawnSync(pnpm, args, { cwd: process.cwd(), stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
