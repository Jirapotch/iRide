import { test } from "node:test";
import assert from "node:assert/strict";
import { runCutover, PHASES, PROJECT_REF } from "./lib/cutover.mjs";
import * as cutover from "./lib/cutover.mjs";
function setup(failure) {
  const calls = [];
  const adapter = Object.fromEntries(
    ["preflight", "saveJournal", ...PHASES].map((name) => [
      name,
      async () => {
        calls.push(name);
        if (name === failure) throw new Error("injected failure");
      },
    ]),
  );
  return { adapter, calls, journal: { completed: [] } };
}
test("cutover is non-mutating by default", async () => {
  const s = setup();
  await runCutover(s.adapter, s.journal, {
    apply: false,
    projectRef: PROJECT_REF,
  });
  assert.deepEqual(s.calls, ["preflight"]);
});
test("wrong production target is rejected before any call", async () => {
  const s = setup();
  await assert.rejects(
    runCutover(s.adapter, s.journal, { apply: true, projectRef: "other" }),
  );
  assert.equal(s.calls.length, 0);
});
test("a failed initial backup never disables writers or deletes data", async () => {
  const s = setup("initialBackup");
  await assert.rejects(
    runCutover(s.adapter, s.journal, { apply: true, projectRef: PROJECT_REF }),
  );
  assert.deepEqual(s.calls, ["preflight", "initialBackup"]);
});
test("a failed final backup or file deletion preserves accounts and database metadata", async () => {
  for (const phase of ["finalBackup", "removeFiles"]) {
    const s = setup(phase);
    await assert.rejects(
      runCutover(s.adapter, s.journal, {
        apply: true,
        projectRef: PROJECT_REF,
      }),
    );
    assert.ok(!s.calls.includes("removeAccounts"));
    assert.ok(!s.calls.includes("resetDatabase"));
  }
});
test("runtime verification must pass before promoting or retiring legacy deployments", async () => {
  const s = setup("verifyRuntime");
  await assert.rejects(
    runCutover(s.adapter, s.journal, { apply: true, projectRef: PROJECT_REF }),
  );
  assert.ok(!s.calls.includes("promote"));
  assert.ok(!s.calls.includes("retireLegacy"));
});
test("resume skips completed phases and records each new completed phase", async () => {
  const s = setup();
  s.journal.completed = PHASES.slice(0, 4);
  await runCutover(s.adapter, s.journal, {
    apply: true,
    projectRef: PROJECT_REF,
  });
  assert.deepEqual(
    s.calls.filter((x) => PHASES.includes(x)),
    PHASES.slice(4),
  );
  assert.deepEqual(s.journal.completed, PHASES);
});
test("reset removes restrictive legacy dependencies before Auth users", () => {
  assert.ok(PHASES.indexOf("resetDatabase") < PHASES.indexOf("removeAccounts"));
});
test("issued upload permissions drain before final snapshot", () => {
  assert.ok(PHASES.includes("drainUploads"));
  assert.ok(PHASES.indexOf("quiesce") < PHASES.indexOf("drainUploads"));
  assert.ok(PHASES.indexOf("drainUploads") < PHASES.indexOf("finalBackup"));
});
test("a production candidate is rejected before maintenance", () => {
  assert.throws(() =>
    cutover.validateStagingDeployment(
      {
        projectId: cutover.WEB_PROJECT,
        readyState: "READY",
        target: "production",
      },
      false,
    ),
  );
  assert.doesNotThrow(() =>
    cutover.validateStagingDeployment(
      { projectId: cutover.WEB_PROJECT, readyState: "READY", target: null },
      false,
    ),
  );
});
test("committed reset marker recovers a lost filesystem journal update", () => {
  const journal = {
    completed: ["removeFiles"],
    runId: "run-1",
    deploymentId: "dpl-new",
  };
  assert.equal(
    cutover.recognizeReset(journal, "iride-reset:run-1:dpl-new"),
    true,
  );
  assert.ok(journal.completed.includes("resetDatabase"));
  assert.equal(
    cutover.recognizeReset(
      { completed: [], runId: "other", deploymentId: "dpl-new" },
      "iride-reset:run-1:dpl-new",
    ),
    false,
  );
});
test("expired URLs cannot pass the drain gate early", () => {
  const stopped = 100000;
  assert.equal(cutover.uploadsDrained(stopped, stopped + 129 * 60000), false);
  assert.equal(cutover.uploadsDrained(stopped, stopped + 130 * 60000), true);
  assert.equal(cutover.uploadsDrained(undefined), false);
});
