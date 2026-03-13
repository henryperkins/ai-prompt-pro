import { defineConfig } from "@playwright/test";

const PLAYWRIGHT_SERVER_HOST = process.env.PLAYWRIGHT_HOST || "127.0.0.1";
const PLAYWRIGHT_SERVER_PORT = process.env.PLAYWRIGHT_PORT || "4217";
const PLAYWRIGHT_DEV_SERVER_URL = `http://${PLAYWRIGHT_SERVER_HOST}:${PLAYWRIGHT_SERVER_PORT}`;
const PLAYWRIGHT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() || PLAYWRIGHT_DEV_SERVER_URL;
const USE_EXTERNAL_BASE_URL = Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());
const REUSE_EXISTING_SERVER = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1";
const PLAYWRIGHT_NEON_DATA_API_URL = "https://neon.test/neondb/rest/v1";
const PLAYWRIGHT_NEON_AUTH_URL = "https://neon.test/neondb/auth";
const PLAYWRIGHT_AGENT_SERVICE_URL = "https://agent.test";

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
    baseURL: PLAYWRIGHT_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: {
        baseURL: PLAYWRIGHT_BASE_URL,
      },
    },
  ],
  webServer: USE_EXTERNAL_BASE_URL
    ? undefined
    : [
      {
        command:
          `VITE_NEON_DATA_API_URL=${PLAYWRIGHT_NEON_DATA_API_URL} `
          + `VITE_NEON_AUTH_URL=${PLAYWRIGHT_NEON_AUTH_URL} `
          + `VITE_AGENT_SERVICE_URL=${PLAYWRIGHT_AGENT_SERVICE_URL} `
          + `npm run dev -- --host ${PLAYWRIGHT_SERVER_HOST} --port ${PLAYWRIGHT_SERVER_PORT}`,
        url: PLAYWRIGHT_DEV_SERVER_URL,
        reuseExistingServer: REUSE_EXISTING_SERVER,
        timeout: 120_000,
      },
    ],
});
