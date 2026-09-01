import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

describe("promote-admin command", () => {
  it("documents the safe default username without connecting to Supabase", () => {
    const result = spawnSync(process.execPath, ["scripts/promote-admin.mjs", "--help"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("jirapotch");
    expect(result.stdout).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
