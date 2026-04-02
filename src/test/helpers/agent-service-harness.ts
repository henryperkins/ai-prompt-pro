import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const STARTUP_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const STARTUP_SENTINEL = "\"event\":\"service_start\"";

export const BASE_ENV = Object.freeze({
  HOST: "127.0.0.1",
  OPENAI_API_KEY: "sk-test",
  REQUIRE_PROVIDER_CONFIG: "false",
  AGENT_SERVICE_TOKEN: "e2e-test-token",
  FUNCTION_PUBLIC_API_KEY: "e2e-test-pubkey",
  GITHUB_CONTEXT_ENABLED: "false",
  CODEX_PROFILE: "",
  CODEX_CONFIG_JSON: "",
});

export type SpawnedAgentService = {
  child: ChildProcessWithoutNullStreams;
  baseUrl: string;
  readonly stdout: string;
  readonly stderr: string;
};

type SpawnAgentServiceOptions = {
  port: number;
  env?: NodeJS.ProcessEnv;
};

async function waitForServiceReady(
  child: ChildProcessWithoutNullStreams,
  readStdout: () => string,
  readStderr: () => string,
): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (readStdout().includes(STARTUP_SENTINEL)) {
      return;
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Service exited before startup (code=${child.exitCode}, signal=${child.signalCode}).`
        + `\nstdout:\n${readStdout()}\nstderr:\n${readStderr()}`,
      );
    }

    await delay(50);
  }

  throw new Error(
    `Timed out waiting for service start.`
    + `\nstdout:\n${readStdout()}\nstderr:\n${readStderr()}`,
  );
}

export async function spawnAgentService({
  port,
  env = {},
}: SpawnAgentServiceOptions): Promise<SpawnedAgentService> {
  let stdout = "";
  let stderr = "";

  const child = spawn(process.execPath, ["agent_service/codex_service.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...BASE_ENV,
      PORT: String(port),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk: Buffer | string) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  await waitForServiceReady(child, () => stdout, () => stderr);

  return {
    child,
    baseUrl: `http://127.0.0.1:${port}`,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

export async function waitForAgentServiceExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs = SHUTDOWN_TIMEOUT_MS,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return {
      code: child.exitCode,
      signal: child.signalCode,
    };
  }

  const [code, signal] = await Promise.race([
    once(child, "exit") as Promise<[number | null, NodeJS.Signals | null]>,
    delay(timeoutMs).then(() => {
      throw new Error(`Timed out waiting for agent service exit after ${timeoutMs}ms.`);
    }),
  ]);

  return { code, signal };
}

export async function killAgentService(child: ChildProcessWithoutNullStreams | null | undefined): Promise<void> {
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill("SIGTERM");

  try {
    await waitForAgentServiceExit(child);
  } catch {
    child.kill("SIGKILL");
    await waitForAgentServiceExit(child);
  }
}

export async function readResponseStreamChunk(response: Response, timeoutMs = 5_000): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  try {
    const result = await Promise.race([
      reader.read(),
      delay(timeoutMs).then(() => {
        throw new Error(`Timed out waiting for streamed response data after ${timeoutMs}ms.`);
      }),
    ]);

    if (result.done) {
      return "";
    }

    return new TextDecoder().decode(result.value);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
