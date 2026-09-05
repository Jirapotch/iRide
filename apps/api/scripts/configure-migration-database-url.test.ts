import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

describe("configure migration database URL command", () => {
  it("writes an encoded pooler URL to GitHub Actions without logging the password", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "iride-migration-url-"));
    const githubEnv = join(temporaryDirectory, "github-env");
    const password = "p@ss:/?#[]";

    try {
      const result = spawnSync(
        process.execPath,
        ["scripts/configure-migration-database-url.mjs"],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            GITHUB_ENV: githubEnv,
            MIGRATION_POOLER_URL:
              "postgresql://postgres.project@pooler.example.com:5432/postgres?sslmode=require",
            SUPABASE_DB_PASSWORD: password,
          },
        },
      );

      expect(result.status).toBe(0);
      expect(readFileSync(githubEnv, "utf8")).toBe(
        "MIGRATION_DATABASE_URL=postgresql://postgres.project:p%40ss%3A%2F%3F%23%5B%5D@pooler.example.com:5432/postgres?sslmode=require\n",
      );
      expect(`${result.stdout}${result.stderr}`).not.toContain(password);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
