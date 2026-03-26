/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";

const TEST_PORT = 18915;
const TEST_ORIGIN = "https://prompt.lakefrontdigital.io";

async function waitForServiceReady(child: ChildProcessWithoutNullStreams): Promise<void> {
  let stdout = "";
  let stderr = "";

  const onStdout = (chunk: Buffer | string) => {
    stdout += chunk.toString();
  };
  const onStderr = (chunk: Buffer | string) => {
    stderr += chunk.toString();
  };

  child.stdout.on("data", onStdout);
  child.stderr.on("data", onStderr);

  try {
    const started = new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => {
        reject(new Error(`Timed out waiting for service start.\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      }, 30_000);

      const poll = setInterval(() => {
        if (stdout.includes("\"event\":\"service_start\"")) {
          clearTimeout(deadline);
          clearInterval(poll);
          resolve();
        }
      }, 50);

      child.once("exit", (code, signal) => {
        clearTimeout(deadline);
        clearInterval(poll);
        reject(new Error(
          `Service exited before startup (code=${code}, signal=${signal}).\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ));
      });
    });

    await started;
  } finally {
    child.stdout.off("data", onStdout);
    child.stderr.off("data", onStderr);
  }
}

describe("agent service CORS preflight", () => {
  let child: ChildProcessWithoutNullStreams | null = null;

  beforeAll(async () => {
    child = spawn(process.execPath, ["agent_service/codex_service.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        OPENAI_API_KEY: "sk-test",
        ALLOWED_ORIGINS: `${TEST_ORIGIN},http://localhost:8080`,
        GITHUB_CONTEXT_ENABLED: "true",
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY:
          "-----BEGIN PRIVATE KEY-----\\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAoQ==\\n-----END PRIVATE KEY-----",
        GITHUB_APP_SLUG: "promptforge-app",
        GITHUB_APP_STATE_SECRET: "state-secret",
        GITHUB_WEBHOOK_SECRET: "webhook-secret",
        GITHUB_POST_INSTALL_REDIRECT_URL: `${TEST_ORIGIN}/builder`,
        NEON_DATABASE_URL: "postgres://promptforge:test@db.example.neon.tech/neondb",
        CODEX_PROFILE: "",
        CODEX_CONFIG_JSON: "",
        REQUIRE_PROVIDER_CONFIG: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    await waitForServiceReady(child);
  });

  afterAll(async () => {
    if (!child || child.killed) return;
    child.kill("SIGTERM");
    await once(child, "exit");
  });

  it("responds to infer preflight with CORS headers", async () => {
    const response = await fetch(`http://127.0.0.1:${TEST_PORT}/infer-builder-fields`, {
      method: "OPTIONS",
      headers: {
        Origin: TEST_ORIGIN,
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("responds to GitHub preflight with route-specific CORS headers", async () => {
    const response = await fetch(`http://127.0.0.1:${TEST_PORT}/github/install-url`, {
      method: "OPTIONS",
      headers: {
        Origin: TEST_ORIGIN,
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
