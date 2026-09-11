import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "HOST=127.0.0.1 HUDDLECANVAS_DATA_FILE=.data/e2e-store.json HUDDLECANVAS_ALLOW_DEV_AUTH=true HUDDLECANVAS_LOGGER=false node --experimental-strip-types apps/api/src/main.ts",
      cwd: "../..",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "pnpm --filter @huddlecanvas/web build && pnpm --filter @huddlecanvas/web preview --host 127.0.0.1",
      cwd: "../..",
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
