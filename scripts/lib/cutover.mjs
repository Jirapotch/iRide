export const PROJECT_REF = "bgflnssilreepfzxoqpc";
export const WEB_PROJECT = "prj_TPZUNq9muMxwuSv2GkYw3BVKrkrX";
export const API_PROJECT = "prj_vSu3TQrB3lz62Ln77iPITdYCAdi4";
export const TEAM = "team_Ua3K9lZjxVvFZ8jlt44JZ0MP";
export const PHASES = [
  "initialBackup",
  "quiesce",
  "drainUploads",
  "finalBackup",
  "removeFiles",
  "resetDatabase",
  "removeAccounts",
  "verifyRuntime",
  "promote",
  "retireLegacy",
];
export async function runCutover(adapter, journal, { apply, projectRef }) {
  if (projectRef !== PROJECT_REF)
    throw new Error("Production project mismatch.");
  await adapter.preflight();
  if (!apply) return;
  for (const phase of PHASES) {
    if (journal.completed.includes(phase)) continue;
    await adapter[phase]();
    journal.completed.push(phase);
    await adapter.saveJournal(journal);
  }
}
export function quoteIdentifier(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}
export function validateStagingDeployment(deployment, resetCompleted) {
  if (
    deployment.projectId !== WEB_PROJECT ||
    deployment.readyState !== "READY" ||
    (!resetCompleted && deployment.target === "production")
  )
    throw new Error(
      "Candidate must be a READY preview in the approved web project before maintenance.",
    );
}
export function recognizeReset(journal, marker) {
  if (marker !== `iride-reset:${journal.runId}:${journal.deploymentId}`)
    return false;
  if (!journal.completed.includes("resetDatabase"))
    journal.completed.push("resetDatabase");
  return true;
}
export function uploadsDrained(stoppedAt, now = Date.now()) {
  // Supabase signed uploads expire at 2h. Include ten minutes for in-flight work.
  return Number.isFinite(stoppedAt) && now >= stoppedAt + 130 * 60000;
}

export async function resetApplicationObjects(database) {
  const relations = (
    await database.query(
      "select n.nspname,c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p','v','m','S') and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') order by c.relkind",
    )
  ).rows;
  for (const row of relations) {
    const kind = {
      r: "table",
      p: "table",
      v: "view",
      m: "materialized view",
      S: "sequence",
    }[row.relkind];
    await database.query(
      "drop " +
        kind +
        " if exists " +
        quoteIdentifier(row.nspname) +
        "." +
        quoteIdentifier(row.relname) +
        " cascade",
    );
  }
  const routines = (
    await database.query(
      "select p.oid::regprocedure::text as signature,p.prokind from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')",
    )
  ).rows;
  for (const row of routines)
    await database.query(
      "drop " +
        (row.prokind === "p"
          ? "procedure"
          : row.prokind === "a"
            ? "aggregate"
            : "function") +
        " if exists " +
        row.signature +
        " cascade",
    );
  const types = (
    await database.query(
      "select n.nspname,t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('public','private') and t.typtype in ('e','d') and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e')",
    )
  ).rows;
  for (const row of types)
    await database.query(
      "drop type if exists " +
        quoteIdentifier(row.nspname) +
        "." +
        quoteIdentifier(row.typname) +
        " cascade",
    );
}
