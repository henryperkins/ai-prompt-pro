/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createGitHubWebhooksHandler } from "../../agent_service/handlers/github-webhooks.mjs";

function createWebhookDeps() {
  return {
    app: {
      verifyWebhookSignature: vi.fn(),
    },
    store: {
      listConnectionsByGithubRepoIds: vi.fn(async () => []),
      markInstallationsDeleted: vi.fn(async () => []),
      markInstallationsSuspended: vi.fn(async () => []),
      reactivateInstallations: vi.fn(async () => []),
      listInstallationsByGithubInstallationId: vi.fn(async () => []),
      revokeConnectionsForInstallationRepos: vi.fn(async () => []),
      reactivateConnectionsForRepoIds: vi.fn(async () => []),
    },
    manifestService: {
      invalidateConnection: vi.fn(async () => undefined),
    },
  };
}

async function invokeWebhook(
  handler: ReturnType<typeof createGitHubWebhooksHandler>,
  {
    event,
    payload,
    signature = "sha256=test-signature",
  }: {
    event: string;
    payload: unknown;
    signature?: string;
  },
) {
  return handler({
    body: JSON.stringify(payload),
    req: {
      headers: {
        "x-github-event": event,
        "x-hub-signature-256": signature,
      },
    },
  });
}

describe("agent service GitHub webhooks", () => {
  it("verifies the webhook signature and invalidates cached manifests on push", async () => {
    const deps = createWebhookDeps();
    deps.store.listConnectionsByGithubRepoIds.mockResolvedValue([
      { id: "conn-1" },
      { id: "conn-2" },
    ]);

    const handler = createGitHubWebhooksHandler(deps);
    const payload = {
      repository: {
        id: 4242,
      },
    };

    const response = await invokeWebhook(handler, {
      event: "push",
      payload,
    });

    expect(deps.app.verifyWebhookSignature).toHaveBeenCalledWith({
      body: JSON.stringify(payload),
      signature: "sha256=test-signature",
    });
    expect(deps.store.listConnectionsByGithubRepoIds).toHaveBeenCalledWith([4242]);
    expect(deps.manifestService.invalidateConnection).toHaveBeenNthCalledWith(1, "conn-1");
    expect(deps.manifestService.invalidateConnection).toHaveBeenNthCalledWith(2, "conn-2");
    expect(response).toEqual({
      status: 202,
      body: {
        ok: true,
      },
    });
  });

  it.each([
    ["deleted", "markInstallationsDeleted"],
    ["suspend", "markInstallationsSuspended"],
    ["unsuspend", "reactivateInstallations"],
    ["created", "reactivateInstallations"],
    ["new_permissions_accepted", "reactivateInstallations"],
  ])(
    "maps installation %s events onto %s",
    async (action, expectedMethod) => {
      const deps = createWebhookDeps();
      const handler = createGitHubWebhooksHandler(deps);

      await invokeWebhook(handler, {
        event: "installation",
        payload: {
          action,
          installation: {
            id: 9001,
          },
        },
      });

      expect(deps.store[expectedMethod as keyof typeof deps.store]).toHaveBeenCalledWith(9001);
      expect(deps.manifestService.invalidateConnection).not.toHaveBeenCalled();
    },
  );

  it("revokes, reactivates, and invalidates affected repositories on installation_repositories changes", async () => {
    const deps = createWebhookDeps();
    deps.store.listInstallationsByGithubInstallationId.mockResolvedValue([
      { id: "install-rec-1" },
      { id: "install-rec-2" },
    ]);
    deps.store.listConnectionsByGithubRepoIds.mockResolvedValue([
      { id: "conn-removed" },
      { id: "conn-added" },
    ]);

    const handler = createGitHubWebhooksHandler(deps);

    await invokeWebhook(handler, {
      event: "installation_repositories",
      payload: {
        installation: {
          id: 9001,
        },
        repositories_removed: [{ id: 111 }, { id: 222 }],
        repositories_added: [{ id: 333 }, { id: 222 }],
      },
    });

    expect(deps.store.listInstallationsByGithubInstallationId).toHaveBeenCalledWith(9001);
    expect(deps.store.revokeConnectionsForInstallationRepos).toHaveBeenNthCalledWith(
      1,
      "install-rec-1",
      [111, 222],
    );
    expect(deps.store.revokeConnectionsForInstallationRepos).toHaveBeenNthCalledWith(
      2,
      "install-rec-2",
      [111, 222],
    );
    expect(deps.store.reactivateConnectionsForRepoIds).toHaveBeenNthCalledWith(
      1,
      "install-rec-1",
      [333, 222],
    );
    expect(deps.store.reactivateConnectionsForRepoIds).toHaveBeenNthCalledWith(
      2,
      "install-rec-2",
      [333, 222],
    );
    expect(deps.store.listConnectionsByGithubRepoIds).toHaveBeenCalledWith([111, 222, 333]);
    expect(deps.manifestService.invalidateConnection).toHaveBeenNthCalledWith(1, "conn-removed");
    expect(deps.manifestService.invalidateConnection).toHaveBeenNthCalledWith(2, "conn-added");
  });
});
