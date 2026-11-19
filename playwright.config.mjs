import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Kolkata",
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--host-resolver-rules=MAP preview.e2b.app 127.0.0.1,MAP arena.test 127.0.0.1"],
    },
  },
});
