import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "src/api-application.ts",
    worker: "src/worker.ts",
  },
  format: ["cjs"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/^@iride\//],
});
