import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.E2E_WEB_PORT ?? "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
});
