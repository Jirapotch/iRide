import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const apiRoot = path.resolve(import.meta.dirname, "..");
const bundlePath = path.join(apiRoot, "dist/main.mjs");
const serverPath = path.join(apiRoot, "server.mjs");

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

const forbiddenSourceEntrypoints = [
  "main.js",
  "main.jsx",
  "main.ts",
  "main.tsx",
  "main.cjs",
  "main.cts",
  "main.mjs",
  "main.mts",
];

for (const filename of forbiddenSourceEntrypoints) {
  const candidate = path.join(apiRoot, "src", filename);
  if (await pathExists(candidate)) {
    throw new Error(
      `Vercel must use server.mjs; remove the competing source entrypoint ${candidate}`,
    );
  }
}

const legacyApiDirectory = path.join(apiRoot, "api");
if (await pathExists(legacyApiDirectory)) {
  const legacyRoutes = (
    await readdir(legacyApiDirectory, { recursive: true })
  ).filter((entry) => /\.[cm]?[jt]sx?$/.test(entry));
  if (legacyRoutes.length > 0) {
    throw new Error(
      `Vercel native NestJS routing cannot coexist with apps/api/api routes: ${legacyRoutes.join(", ")}`,
    );
  }
}

const serverSource = await readFile(serverPath, "utf8");
if (!serverSource.includes('import "@nestjs/core"')) {
  throw new Error("server.mjs must import @nestjs/core for Vercel detection");
}
if (!serverSource.includes('from "./dist/main.mjs"')) {
  throw new Error("server.mjs must load the ESM production bundle");
}

const bundleSource = await readFile(bundlePath, "utf8");
const internalRuntimeImport =
  /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']@iride\//;
if (internalRuntimeImport.test(bundleSource)) {
  throw new Error(
    "dist/main.mjs still imports @iride workspace source at runtime",
  );
}
if (/\brequire\s*\(\s*["']@nestjs\//.test(bundleSource)) {
  throw new Error(
    "dist/main.mjs must import ESM NestJS packages without require()",
  );
}

const apiBundle = await import(
  `${pathToFileURL(bundlePath).href}?verify=${Date.now()}`
);
if (typeof apiBundle.startApiServer !== "function") {
  throw new Error("dist/main.mjs does not export startApiServer()");
}

process.stdout.write("Verified Vercel API ESM bundle and entrypoint invariants\n");
