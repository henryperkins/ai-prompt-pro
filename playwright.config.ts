import { defineConfig } from "@playwright/test";

const MOBILE_FLAG_ON_SERVER_URL = "http://127.0.0.1:4173";
const MOBILE_FLAG_OFF_SERVER_URL = "http://127.0.0.1:4174";

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
    baseURL: MOBILE_FLAG_ON_SERVER_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-flag-on",
      testIgnore: /.*\.flag-off\.spec\.ts/,
      use: {
        baseURL: MOBILE_FLAG_ON_SERVER_URL,
      },
    },
    {
      name: "mobile-flag-off",
      testMatch: /.*\.flag-off\.spec\.ts/,
      use: {
        baseURL: MOBILE_FLAG_OFF_SERVER_URL,
      },
    },
  ],
  webServer: [
    {
      command: "VITE_COMMUNITY_MOBILE_ENHANCEMENTS=true npm run dev -- --host 127.0.0.1 --port 4173",
      url: MOBILE_FLAG_ON_SERVER_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "VITE_COMMUNITY_MOBILE_ENHANCEMENTS=false npm run dev -- --host 127.0.0.1 --port 4174",
      url: MOBILE_FLAG_OFF_SERVER_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
