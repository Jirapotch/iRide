import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const fixtures: string[] = [];

afterEach(async () => {
  globalThis.__IRIDE_START_API_SERVER__ = undefined;
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
      "module.exports = {};",
    );
    await writeFile(
      path.join(fixture, "dist/main.js"),
      `module.exports = {
        startApiServer: async () => {
          globalThis.__IRIDE_START_API_SERVER__ = true;
        }
      };`,
    );

    const loaded = await import(
      `${pathToFileURL(path.join(fixture, "server.mjs")).href}?test=${Date.now()}`
    );
    await loaded.default;

    expect(globalThis.__IRIDE_START_API_SERVER__).toBe(true);
  });
});

declare global {
  var __IRIDE_START_API_SERVER__: boolean | undefined;
}
