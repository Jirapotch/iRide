// Explicit, resumable production reset. Default invocation performs read-only preflight.
import { readFile, writeFile, mkdir, stat, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import {
  runCutover,
  resetApplicationObjects,
  PROJECT_REF,
  WEB_PROJECT,
  API_PROJECT,
  TEAM,
  validateStagingDeployment,
  recognizeReset,
  uploadsDrained,
} from "./lib/cutover.mjs";
const apply = process.argv.includes("--apply"),
  resume = process.argv.includes("--resume");
const argument = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? null : process.argv[i + 1];
};
const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "MIGRATION_DATABASE_URL",
  "PG_DUMP_PATH",
  "PG_RESTORE_PATH",
  "VERCEL_TOKEN",
  "NEW_DEPLOYMENT_ID",
  "GOOGLE_DRIVE_CLIENT_ID",
  "GOOGLE_DRIVE_CLIENT_SECRET",
  "GOOGLE_DRIVE_REFRESH_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(
    "Preflight blocked; missing environment variables: " + missing.join(", "),
  );
  process.exit(1);
}
const projectRef =
  argument("--project-ref") ?? process.env.SUPABASE_PROJECT_REF;
if (
  projectRef !== PROJECT_REF ||
  new URL(process.env.SUPABASE_URL).hostname !== PROJECT_REF + ".supabase.co"
)
  throw new Error("Target must be the approved Supabase project.");
const dbUrl = new URL(process.env.MIGRATION_DATABASE_URL);
if (
  !dbUrl.hostname.endsWith(".supabase.com") &&
  !dbUrl.hostname.endsWith(".supabase.co")
)
  throw new Error("Only Supabase database hosts are allowed.");
if (
  !["db." + PROJECT_REF + ".supabase.co"].includes(dbUrl.hostname) &&
  decodeURIComponent(dbUrl.username) !== "postgres." + PROJECT_REF
)
  throw new Error("Database connection project mismatch.");
if (!process.env.R2_BUCKET.startsWith("iride"))
  throw new Error("R2 bucket must be an iRide bucket.");
const backupRoot = resolve("backups"),
  directory = resolve(
    argument("--backup-dir") ??
      join(backupRoot, new Date().toISOString().replaceAll(":", "-")),
  );
const { relative, isAbsolute } = await import("node:path");
const relativeDirectory = relative(backupRoot, directory);
if (
  !relativeDirectory ||
  relativeDirectory.startsWith("..") ||
  isAbsolute(relativeDirectory)
)
  throw new Error(
    "Backup directory must be inside this checkout's backups directory.",
  );
const journalPath = join(directory, "journal.json");
let journal = {
  runId: randomUUID(),
  projectRef,
  completed: [],
  deploymentId: process.env.NEW_DEPLOYMENT_ID,
};
if (resume) {
  journal = JSON.parse(await readFile(journalPath, "utf8"));
  if (
    journal.projectRef !== projectRef ||
    journal.deploymentId !== process.env.NEW_DEPLOYMENT_ID
  )
    throw new Error("Resume target/deployment mismatch.");
}
const ca = await readFile(
  new URL("./certs/supabase-root-ca-bundle.crt", import.meta.url),
  "utf8",
);
dbUrl.search = "";
const database = new pg.Client({
  connectionString: dbUrl.toString(),
  ssl: { ca, rejectUnauthorized: true },
  connectionTimeoutMillis: 20000,
});
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const s3 = new S3Client({
  region: "auto",
  endpoint:
    "https://" +
    process.env.CLOUDFLARE_ACCOUNT_ID +
    ".r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const check = (result) => {
  if (result.error)
    throw new Error(
      "Supabase operation failed: " + (result.error.code ?? "unknown"),
    );
  return result.data;
};
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
async function vercel(path, method = "GET", body) {
  const response = await fetch(
    "https://api.vercel.com" +
      path +
      (path.includes("?") ? "&" : "?") +
      "teamId=" +
      TEAM,
    {
      method,
      headers: {
        Authorization: "Bearer " + process.env.VERCEL_TOKEN,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok) {
    const error = new Error(
      "Vercel operation failed (" + response.status + ").",
    );
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? {} : response.json();
}
async function runBinary(binary, args, env = process.env) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(binary, args, {
      env,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    child.stderr.resume();
    child.on("error", () =>
      reject(new Error("Cannot start required PostgreSQL tool.")),
    );
    child.on("close", (code) =>
      code === 0
        ? resolveRun()
        : reject(
            new Error(
              "PostgreSQL backup tool failed. No credentials were logged.",
            ),
          ),
    );
  });
}
async function authConfiguration(method = "GET", value) {
  const response = await fetch(
    "https://api.supabase.com/v1/projects/" + PROJECT_REF + "/config/auth",
    {
      method,
      headers: {
        Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      ...(value ? { body: JSON.stringify(value) } : {}),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new Error("Supabase Auth configuration request failed.");
  return response.json();
}
async function manifest() {
  const buckets = check(await supabase.storage.listBuckets());
  const allowed = [
    "avatars",
    "garage-documents",
    "media",
    "post-media",
    "vehicle-media",
  ];
  if (buckets.some((bucket) => !allowed.includes(bucket.id)))
    throw new Error("Unexpected storage bucket; review before reset.");
  const objects = (
    await database.query(
      "select bucket_id,name,updated_at,metadata from storage.objects order by bucket_id,name",
    )
  ).rows;
  const r2 = [];
  let continuation;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        ...(continuation ? { ContinuationToken: continuation } : {}),
      }),
    );
    for (const file of page.Contents ?? [])
      r2.push({ key: file.Key, size: file.Size, etag: file.ETag });
    continuation = page.NextContinuationToken;
  } while (continuation);
  return {
    projectRef,
    buckets: buckets.map((b) => b.id).sort(),
    objects,
    r2Bucket: process.env.R2_BUCKET,
    r2,
  };
}
async function backup(name) {
  const destination = join(directory, name);
  await mkdir(destination, { recursive: true });
  const pgEnvironment = {
    ...process.env,
    PGHOST: dbUrl.hostname,
    PGPORT: dbUrl.port || "5432",
    PGUSER: decodeURIComponent(dbUrl.username),
    PGPASSWORD: decodeURIComponent(dbUrl.password),
    PGDATABASE: dbUrl.pathname.slice(1),
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: resolve("scripts/certs/supabase-root-ca-bundle.crt"),
  };
  const dump = join(destination, "database.dump");
  await runBinary(
    process.env.PG_DUMP_PATH,
    ["--format=custom", "--no-owner", "--no-acl", "--file", dump],
    pgEnvironment,
  );
  await runBinary(process.env.PG_RESTORE_PATH, ["--list", dump]);
  if ((await stat(dump)).size < 1024)
    throw new Error("Database backup appears incomplete.");
  const files = await manifest(),
    checksums = [];
  let index = 0;
  for (const file of files.objects) {
    const blob = check(
      await supabase.storage.from(file.bucket_id).download(file.name),
    );
    const bytes = Buffer.from(await blob.arrayBuffer());
    const local = "file-" + index++ + ".bin";
    await writeFile(join(destination, local), bytes, { mode: 0o600 });
    checksums.push({
      provider: "supabase",
      bucket: file.bucket_id,
      key: file.name,
      local,
      bytes: bytes.length,
      sha256: sha(bytes),
    });
  }
  for (const file of files.r2) {
    const object = await s3.send(
      new GetObjectCommand({ Bucket: files.r2Bucket, Key: file.key }),
    );
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    if (bytes.length !== file.size) throw new Error("R2 backup size mismatch.");
    const local = "file-" + index++ + ".bin";
    await writeFile(join(destination, local), bytes, { mode: 0o600 });
    checksums.push({
      provider: "r2",
      bucket: files.r2Bucket,
      key: file.key,
      etag: file.etag,
      local,
      bytes: bytes.length,
      sha256: sha(bytes),
    });
  }
  const complete = {
    ...files,
    checksums,
    database: { local: "database.dump", sha256: sha(await readFile(dump)) },
  };
  if (JSON.stringify(await manifest()) !== JSON.stringify(files))
    throw new Error(
      "Storage changed during backup; no final snapshot accepted.",
    );
  for (const item of checksums)
    if (sha(await readFile(join(destination, item.local))) !== item.sha256)
      throw new Error("Backup verification failed.");
  await writeFile(
    join(destination, "manifest.json"),
    JSON.stringify(complete, null, 2),
    { mode: 0o600 },
  );
  console.log(name + " verified: " + checksums.length + " files.");
}
let deployment;
async function runtimeHealth() {
  const response = await fetch("https://" + deployment.url + "/api/health", {
    headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          "x-vercel-protection-bypass":
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : {},
    signal: AbortSignal.timeout(60000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Staged runtime is not accessible.");
  const health = await response.json();
  if (
    health.service !== "iride-personal-garage-v1" ||
    !health.databaseConfigured ||
    !health.driveConfigured
  )
    throw new Error("Staged runtime/configuration is not ready.");
}
const adapter = {
  async preflight() {
    const marker = (
      await database.query(
        "select obj_description(to_regclass('public.garage_vehicles'),'pg_class') as marker",
      )
    ).rows[0].marker;
    if (resume && recognizeReset(journal, marker))
      await adapter.saveJournal(journal);
    deployment = await vercel(
      "/v13/deployments/" + process.env.NEW_DEPLOYMENT_ID,
    );
    validateStagingDeployment(
      deployment,
      journal.completed.includes("resetDatabase"),
    );
    await runtimeHealth();
    check(await supabase.auth.admin.listUsers({ page: 1, perPage: 1 }));
    await authConfiguration();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!tokenResponse.ok)
      throw new Error("Drive owner connection is invalid.");
    const token = (await tokenResponse.json()).access_token;
    const root = await fetch(
      "https://www.googleapis.com/drive/v3/files/1mFCIBIJHkQjYn4y_gg0GRkiELEatHMf0?fields=id,mimeType,trashed,capabilities",
      {
        headers: { Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!root.ok) throw new Error("Drive destination is not accessible.");
    const folder = await root.json();
    if (folder.trashed || !folder.capabilities?.canAddChildren)
      throw new Error("Drive folder is not writable.");
    if (!journal.completed.includes("resetDatabase")) {
      const legacy = await database.query(
        "select to_regclass('public.posts') is not null as old, to_regclass('public.garage_service_records') is not null as fresh",
      );
      if (!legacy.rows[0].old || legacy.rows[0].fresh)
        throw new Error(
          "Expected legacy schema was not found; refusing a fresh Garage reset.",
        );
    }
    await manifest();
    for (const id of [WEB_PROJECT, API_PROJECT]) {
      let project;
      try {
        project = await vercel("/v9/projects/" + id);
      } catch (error) {
        if (
          id === API_PROJECT &&
          journal.completed.includes("retireLegacy") &&
          error.status === 404
        )
          continue;
        throw error;
      }
      if (project.link)
        throw new Error(
          "Disconnect legacy Git auto-deployment in Vercel settings before cutover.",
        );
    }
    await runBinary(process.env.PG_DUMP_PATH, ["--version"]);
    await runBinary(process.env.PG_RESTORE_PATH, ["--version"]);
    console.log("Read-only preflight passed for " + projectRef + ".");
  },
  initialBackup: () => backup("initial"),
  async quiesce() {
    await vercel("/v1/projects/" + API_PROJECT + "/pause", "POST");
    await vercel("/v1/projects/" + WEB_PROJECT + "/pause", "POST");
    await authConfiguration("PATCH", {
      disable_signup: true,
      external_anonymous_users_enabled: false,
    });
    await database.query(
      "update cron.job set active=false where jobname='iride-drain-jobs'; revoke all on all tables in schema public, private from public, anon, authenticated; revoke all on all sequences in schema public, private from public, anon, authenticated; revoke all on all tables in schema storage from public,anon,authenticated;",
    );
    const routines = (
      await database.query(
        "select p.oid::regprocedure::text as signature,p.prokind from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind in ('f','p') and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')",
      )
    ).rows;
    for (const row of routines)
      await database.query(
        "revoke execute on " +
          (row.prokind === "p" ? "procedure " : "function ") +
          row.signature +
          " from public,anon,authenticated",
      );
    for (const id of [API_PROJECT, WEB_PROJECT]) {
      for (;;) {
        const list = await vercel(
          "/v6/deployments?projectId=" + id + "&limit=100",
        );
        const old = list.deployments.filter((d) => d.uid !== deployment.id);
        if (!old.length) break;
        await mkdir(directory, { recursive: true });
        await writeFile(
          join(
            directory,
            "retired-deployments-" + id + "-" + Date.now() + ".json",
          ),
          JSON.stringify(old, null, 2),
          { mode: 0o600 },
        );
        for (const item of old)
          await vercel("/v13/deployments/" + item.uid, "DELETE");
      }
    }
    journal.writersStoppedAt = Date.now();
  },
  async drainUploads() {
    if (!uploadsDrained(journal.writersStoppedAt))
      throw new Error(
        "Issued upload URLs are still draining. Resume after " +
          new Date(journal.writersStoppedAt + 130 * 60000).toISOString() +
          "; no files/data have been deleted.",
      );
    for (const id of [API_PROJECT, WEB_PROJECT]) {
      const list = await vercel(
        "/v6/deployments?projectId=" + id + "&limit=100",
      );
      if (list.deployments.some((d) => d.uid !== deployment.id))
        throw new Error("A legacy deployment reappeared; do not continue.");
    }
    const active = await database.query(
      "select count(*)::int as n from pg_stat_activity where pid<>pg_backend_pid() and state='active' and query ~* '(insert|update|delete|call)' and query ~* '(public\\.|private\\.|storage\\.|profiles|media|vehicles)' ",
    );
    if (active.rows[0].n)
      throw new Error("Legacy database writes are still active.");
  },
  finalBackup: () => backup("final"),
  async removeFiles() {
    const saved = JSON.parse(
      await readFile(join(directory, "final/manifest.json"), "utf8"),
    );
    if (
      saved.projectRef !== projectRef ||
      saved.r2Bucket !== process.env.R2_BUCKET
    )
      throw new Error("Manifest target mismatch.");
    if (
      sha(await readFile(join(directory, "final/database.dump"))) !==
      saved.database.sha256
    )
      throw new Error("Backup checksum mismatch.");
    for (const file of saved.checksums) {
      if (
        sha(await readFile(join(directory, "final", file.local))) !==
        file.sha256
      )
        throw new Error("File backup checksum mismatch.");
      if (file.provider === "supabase") {
        const current = await supabase.storage
          .from(file.bucket)
          .download(file.key);
        if (current.error && String(current.error.statusCode) !== "404")
          check(current);
        if (
          current.data &&
          sha(Buffer.from(await current.data.arrayBuffer())) !== file.sha256
        )
          throw new Error("Supabase object changed after backup.");
        check(await supabase.storage.from(file.bucket).remove([file.key]));
      } else {
        try {
          const current = await s3.send(
            new HeadObjectCommand({ Bucket: file.bucket, Key: file.key }),
          );
          if (current.ETag !== file.etag)
            throw new Error("R2 object changed after backup.");
          await s3.send(
            new DeleteObjectCommand({ Bucket: file.bucket, Key: file.key }),
          );
        } catch (error) {
          if (error.$metadata?.httpStatusCode !== 404) throw error;
        }
      }
    }
    const present = check(await supabase.storage.listBuckets()).map(
      (b) => b.id,
    );
    for (const bucket of saved.buckets)
      if (present.includes(bucket))
        check(await supabase.storage.deleteBucket(bucket));
    const remaining = await manifest();
    if (
      remaining.objects.length ||
      remaining.r2.length ||
      remaining.buckets.length
    )
      throw new Error("Storage cleanup incomplete; metadata was retained.");
  },
  async removeAccounts() {
    const users = [];
    for (let page = 1; ; page++) {
      const data = check(
        await supabase.auth.admin.listUsers({ page, perPage: 1000 }),
      );
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    for (const user of users)
      check(await supabase.auth.admin.deleteUser(user.id));
  },
  async resetDatabase() {
    await database.query("begin");
    try {
      await database.query(
        "select cron.unschedule(jobid) from cron.job where jobname='iride-drain-jobs'",
      );
      await database.query(
        "select pgmq.drop_queue(queue_name) from pgmq.meta where queue_name in ('media_processing','media_cleanup')",
      );
      // Only application namespaces. Never drop auth/storage/cron/pgmq/internal Supabase schemas.
      await resetApplicationObjects(database);
      const migration = await readFile(
        new URL(
          "../supabase/migrations/20261011165416_personal_garage.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await database.query(migration);
      const completionMarker = `iride-reset:${journal.runId}:${journal.deploymentId}`;
      const comment = (
        await database.query(
          "select format('comment on table public.garage_vehicles is %L',$1::text) as sql",
          [completionMarker],
        )
      ).rows[0].sql;
      await database.query(comment);
      await database.query(
        "delete from supabase_migrations.schema_migrations; insert into supabase_migrations.schema_migrations(version,name,statements) values('20261011165416','personal_garage',$1)",
        [[migration]],
      );
      await database.query("notify pgrst, 'reload schema'; commit");
    } catch (error) {
      await database.query("rollback");
      throw error;
    }
    const rows = await database.query(
      "select (select count(*) from public.garage_vehicles)+(select count(*) from public.garage_service_records)+(select count(*) from public.garage_vehicle_photos) as n",
    );
    if (Number(rows.rows[0].n) !== 0) throw new Error("Baseline is not empty.");
  },
  async verifyRuntime() {
    await runtimeHealth();
    const response = await fetch(
      "https://" + deployment.url + "/api/garage/vehicles",
      {
        headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? {
              "x-vercel-protection-bypass":
                process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
            }
          : {},
        signal: AbortSignal.timeout(60000),
        cache: "no-store",
      },
    );
    if (!response.ok || JSON.stringify(await response.json()) !== "[]")
      throw new Error("Staged Garage did not return an empty baseline.");
  },
  async promote() {
    await vercel(
      "/v10/projects/" + WEB_PROJECT + "/promote/" + deployment.id,
      "POST",
    );
    await vercel("/v1/projects/" + WEB_PROJECT + "/unpause", "POST");
  },
  async retireLegacy() {
    let api = null;
    try {
      api = await vercel("/v9/projects/" + API_PROJECT);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    if (api) {
      await writeFile(
        join(directory, "retired-api.json"),
        JSON.stringify(api, null, 2),
        { mode: 0o600 },
      );
      await vercel("/v9/projects/" + API_PROJECT, "DELETE");
    }
    // Removing old deployments retires their server-side service-role credential holders.
    for (;;) {
      const list = await vercel(
        "/v6/deployments?projectId=" + WEB_PROJECT + "&limit=100",
      );
      const old = list.deployments.filter((d) => d.uid !== deployment.id);
      if (!old.length) break;
      for (const oldDeployment of old)
        await vercel("/v13/deployments/" + oldDeployment.uid, "DELETE");
    }
  },
  async saveJournal(value) {
    await mkdir(directory, { recursive: true });
    await writeFile(journalPath + ".tmp", JSON.stringify(value, null, 2), {
      mode: 0o600,
      flush: true,
    });
    await rename(journalPath + ".tmp", journalPath);
    console.log("Completed: " + value.completed.at(-1));
  },
};
try {
  await database.connect();
  await runCutover(adapter, journal, { apply, projectRef });
  console.log(
    apply
      ? "Cutover phases completed. Verify live CRUD, upload and production domains before closing the release."
      : "No production data was changed. Use --apply --project-ref " +
          PROJECT_REF +
          " only after review.",
  );
} catch (error) {
  console.error(
    "Cutover stopped: " +
      (error instanceof Error ? error.message : "unknown error"),
  );
  console.error(
    "Completed phases are recorded in the backup journal. Keep legacy writers disabled after a partial reset; fix the cause and use --resume with the same --backup-dir.",
  );
  process.exitCode = 1;
} finally {
  await database.end();
  s3.destroy();
}
