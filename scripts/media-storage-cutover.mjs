/* global process, console, URL */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  PROJECT_REF,
  validateOptions,
  validateManifest,
  buildManifest,
  applyManifest,
} from "./media-storage-cutover-core.mjs";
import {
  createDatabaseAdapter,
  createStorageAdapter,
} from "./media-storage-cutover-adapters.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function main() {
  const env = process.env;
  if (env.DRY_RUN !== undefined && !["true", "false"].includes(env.DRY_RUN))
    throw new Error("CUTOVER_DRY_RUN_INVALID");
  const options = {
    projectRef: env.CONFIRM_PROJECT_REF,
    dryRun: env.DRY_RUN !== "false",
    confirmation: env.CONFIRMATION,
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
  };
  // Confirm destructive intent and the hard-coded project before credentials,
  // dependency loading, filesystem writes, or network connections.
  validateOptions({
    ...options,
    accountId: options.accountId ?? "pending",
    bucket: options.bucket ?? "pending",
  });
  const mode = process.argv[2];
  if (!["export", "validate", "apply"].includes(mode))
    throw new Error("CUTOVER_MODE_INVALID");
  validateOptions(options);
  const directory = "cutover-manifest";
  let manifest;
  if (mode !== "export") {
    const bytes = await readFile(`${directory}/manifest.json`);
    if (
      digest(bytes) !==
      (await readFile(`${directory}/manifest.sha256`, "utf8")).trim()
    )
      throw new Error("CUTOVER_MANIFEST_DIGEST_MISMATCH");
    manifest = JSON.parse(bytes);
    validateManifest(manifest, options);
    if (mode === "validate") {
      console.log(
        `Validated manifest: ${manifest.media.length} legacy media rows.`,
      );
      return;
    }
  }
  if (
    !env.SUPABASE_DB_PASSWORD ||
    !env.SUPABASE_CA_CERT_PATH ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !/^[a-f0-9]{32}$/i.test(options.accountId)
  )
    throw new Error("CUTOVER_CREDENTIALS_REQUIRED");
  const { Client } = createRequire(
    new URL("../apps/api/package.json", import.meta.url),
  )("pg");
  const commands = createRequire(
    new URL("../packages/storage/package.json", import.meta.url),
  )("@aws-sdk/client-s3");
  const client = new Client({
    host: "aws-0-ap-southeast-2.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    user: `postgres.${PROJECT_REF}`,
    password: env.SUPABASE_DB_PASSWORD,
    ssl: {
      rejectUnauthorized: true,
      ca: await readFile(env.SUPABASE_CA_CERT_PATH, "utf8"),
    },
    connectionTimeoutMillis: 15000,
    statement_timeout: 120000,
    application_name: "iride-media-storage-cutover",
  });
  const s3 = new commands.S3Client({
    region: "auto",
    endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  try {
    await client.connect();
    const deps = {
      db: createDatabaseAdapter(client),
      storage: createStorageAdapter(s3, commands, options.bucket),
    };
    if (mode === "export") {
      manifest = await buildManifest(options, deps);
      validateManifest(manifest, options);
      const bytes = JSON.stringify(manifest, null, 2) + "\n";
      await mkdir(directory, { recursive: true });
      await writeFile(`${directory}/manifest.json`, bytes, { flag: "wx" });
      await writeFile(`${directory}/manifest.sha256`, digest(bytes) + "\n", {
        flag: "wx",
      });
      console.log(
        `Exported manifest: ${manifest.media.length} legacy media rows.`,
      );
    } else {
      try {
        const result = await applyManifest(manifest, options, deps);
        await writeFile(
          "cutover-result.json",
          JSON.stringify(result, null, 2) + "\n",
          { flag: "wx" },
        );
        console.log(
          `Cutover finished: ${result.deleted?.length ?? 0} rows deleted; dry-run=${result.dryRun}.`,
        );
      } catch (error) {
        if (error.result)
          await writeFile(
            "cutover-result.json",
            JSON.stringify(error.result, null, 2) + "\n",
            { flag: "wx" },
          );
        throw error;
      }
    }
  } finally {
    await client.end();
    s3.destroy();
  }
}

main().catch((error) => {
  // SDK and database errors can contain credentials, hostnames or row content.
  console.error(
    /^CUTOVER_[A-Z_]+$/.test(error.message)
      ? error.message
      : "CUTOVER_OPERATION_FAILED",
  );
  process.exitCode = 1;
});
