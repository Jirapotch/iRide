/* global process, URL */
import { appendFileSync, statSync } from "node:fs";

const githubEnv = process.env.GITHUB_ENV;
const poolerUrl = process.env.MIGRATION_POOLER_URL;
const caCertificatePath = process.env.SUPABASE_CA_CERT_PATH;
const databasePassword = process.env.SUPABASE_DB_PASSWORD;

if (!githubEnv || !poolerUrl || !caCertificatePath || !databasePassword) {
  throw new Error(
    "GITHUB_ENV, MIGRATION_POOLER_URL, SUPABASE_CA_CERT_PATH, and SUPABASE_DB_PASSWORD are required.",
  );
}

if (!statSync(caCertificatePath).isFile()) {
  throw new Error("SUPABASE_CA_CERT_PATH must point to a CA certificate file.");
}

const migrationUrl = new URL(poolerUrl);
migrationUrl.password = databasePassword;

appendFileSync(
  githubEnv,
  `MIGRATION_DATABASE_URL=${migrationUrl.toString()}\nNODE_EXTRA_CA_CERTS=${caCertificatePath}\n`,
  "utf8",
);
