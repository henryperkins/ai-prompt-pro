import { defineConfig } from "@playwright/test";

const DEV_SERVER_URL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./playwright",
  timeout: 90_000,
  expect: {
    timeout: 12_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: DEV_SERVER_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: DEV_SERVER_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
