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
  const committedLines = committed.split("\n");
  const generatedLines = generated.split("\n");
  const mismatchIndex = Array.from(
    { length: Math.max(committedLines.length, generatedLines.length) },
    (_, index) => index,
  ).find((index) => committedLines[index] !== generatedLines[index]);
  const functionOrder = (source) => {
    const functions = source.match(
      / {4}Functions: \{([\s\S]*?)\n {4}Enums: \{/,
    );
    return functions
      ? [...functions[1].matchAll(/^ {6}([a-zA-Z0-9_]+): \{/gm)].map(
          (match) => match[1],
        )
      : [];
  };

  process.stderr.write(
    [
      "Generated Supabase types have drifted. Run `pnpm db:types` and commit the result.",
      `First mismatch at line ${(mismatchIndex ?? 0) + 1}.`,
      `Committed: ${JSON.stringify(committedLines[mismatchIndex ?? 0] ?? "<eof>")}`,
      `Generated: ${JSON.stringify(generatedLines[mismatchIndex ?? 0] ?? "<eof>")}`,
      `Committed function order: ${functionOrder(committed).join(", ")}`,
      `Generated function order: ${functionOrder(generated).join(", ")}`,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

process.stdout.write(
  "Generated Supabase types match the committed contract.\n",
);
