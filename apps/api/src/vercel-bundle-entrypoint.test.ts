import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const fixtures: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    fixtures
      .splice(0)
      .map((fixture) => rm(fixture, { recursive: true, force: true })),
  );
});

describe("Vercel bundle entrypoint", () => {
  it("starts the self-contained build instead of importing workspace source", async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), "iride-vercel-bundle-"));
    fixtures.push(fixture);
    await mkdir(path.join(fixture, "dist"));
    await mkdir(path.join(fixture, "node_modules/@nestjs/core"), {
      recursive: true,
    });

    const entrypoint = await readFile(
      path.resolve(import.meta.dirname, "../server.mjs"),
      "utf8",
    );
    await writeFile(path.join(fixture, "server.mjs"), entrypoint);
    await writeFile(
      path.join(fixture, "node_modules/@nestjs/core/index.js"),
      "export {};",
    );
    await writeFile(
      path.join(fixture, "node_modules/@nestjs/core/package.json"),
      JSON.stringify({ type: "module", exports: "./index.js" }),
    );
    await writeFile(
      path.join(fixture, "dist/main.mjs"),
      `import { writeFile } from "node:fs/promises";
       export async function startApiServer() {
         await writeFile(process.env.IRIDE_TEST_SIGNAL, "started");
       }`,
    );

    const signalPath = path.join(fixture, "started.txt");
    await execFileAsync(process.execPath, [path.join(fixture, "server.mjs")], {
      env: { ...process.env, IRIDE_TEST_SIGNAL: signalPath },
    });

    await expect(readFile(signalPath, "utf8")).resolves.toBe("started");
  });
});
