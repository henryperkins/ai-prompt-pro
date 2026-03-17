/* @vitest-environment node */
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createGitHubAppClient } from "../../agent_service/github-app.mjs";

describe("agent service GitHub API version header", () => {
  it("sends the verified GitHub API version header on app-authenticated requests", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ id: 321 }),
    }));

    const app = createGitHubAppClient(
      {
        enabled: true,
        appId: "12345",
        appPrivateKey: privateKeyPem,
        appSlug: "promptforge-app",
        stateSecret: "state-secret",
        webhookSecret: "webhook-secret",
      },
      {
        fetchImpl,
        now: () => Date.parse("2026-03-17T00:00:00.000Z"),
      },
    );

    await app.getInstallationDetails(321);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/321",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-GitHub-Api-Version": "2026-03-10",
        }),
      }),
    );
  });
});
