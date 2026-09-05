import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));

describe("typeorm migration command", () => {
  it("rejects an unknown action before initializing the database", () => {
    const result = spawnSync(process.execPath, [tsxCli, "scripts/typeorm-migrations.ts", "invalid"], {
      cwd: apiRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected migration action: show, run, or revert.");
    expect(result.stderr).not.toContain("Transform failed");
  });
});
