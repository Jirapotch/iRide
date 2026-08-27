/* global process */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { format } from "prettier";

const command = process.execPath;
const cli = resolve("node_modules/supabase/dist/supabase.js");
const sourceFlag = process.argv.includes("--linked") ? "--linked" : "--local";
const result = spawnSync(
  command,
  [cli, "gen", "types", "typescript", sourceFlag, "--schema", "public"],
  {
    encoding: "utf8",
    windowsHide: true,
  },
);

if (result.status !== 0) {
  process.stderr.write(
    result.stderr ||
      result.error?.message ||
      "Supabase type generation failed.\n",
  );
  process.exit(result.status ?? 1);
}

const destination = resolve("packages/database/src/types.ts");
const committed = readFileSync(destination, "utf8")
  .replaceAll("\r\n", "\n")
  .trimEnd();
const generated = (await format(result.stdout, { filepath: destination }))
  .replaceAll("\r\n", "\n")
  .trimEnd();

if (committed !== generated) {
  process.stderr.write(
    "Generated Supabase types have drifted. Run `pnpm db:types` and commit the result.\n",
  );
  process.exit(1);
}

process.stdout.write(
  "Generated Supabase types match the committed contract.\n",
);
