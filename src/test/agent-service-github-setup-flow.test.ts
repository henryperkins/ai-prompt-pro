/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createGitHubInstallUrlHandler } from "../../agent_service/handlers/github-install-url.mjs";
import { createGitHubSetupReturnHandler } from "../../agent_service/handlers/github-setup-return.mjs";

function createRuntime(
  postInstallRedirectUrl = "https://promptforge.test/",
  corsConfig = {
    mode: "set" as const,
    origins: new Set(["http://localhost:8080"]),
  },
) {
  return {
    corsConfig,
    githubConfig: {
      postInstallRedirectUrl,
    },
  };
}

describe("agent service GitHub setup flow", () => {
  it("scopes the post-install return target to the requesting frontend origin", async () => {
    const app = {
      createNonce: vi.fn(() => "nonce-1"),
      createSetupState: vi.fn(() => "signed-state"),
      buildInstallUrl: vi.fn(({ state }: { state: string }) => `https://github.com/apps/promptforge/installations/new?state=${state}`),
    };
    const store = {
      createSetupState: vi.fn(async () => undefined),
    };

    const handler = createGitHubInstallUrlHandler({
      app,
      store,
      runtime: createRuntime("https://promptforge.test/builder?tab=context#github"),
    });

    const response = await handler({
      auth: { userId: "user-1" },
      req: {
        headers: {
          origin: "http://localhost:8080",
        },
      },
    });

    expect(app.createSetupState).toHaveBeenCalledWith({
      userId: "user-1",
      nonce: "nonce-1",
      returnTo: "http://localhost:8080/builder?tab=context#github",
    });
    expect(store.createSetupState).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        nonce: "nonce-1",
      }),
    );
    expect(response).toEqual({
      status: 200,
      body: {
        installUrl: "https://github.com/apps/promptforge/installations/new?state=signed-state",
      },
    });
  });

  it("falls back to the configured return target when no request origin is available", async () => {
    const app = {
      createNonce: vi.fn(() => "nonce-2"),
      createSetupState: vi.fn(() => "signed-state"),
      buildInstallUrl: vi.fn(() => "https://github.com/apps/promptforge/installations/new"),
    };
    const store = {
      createSetupState: vi.fn(async () => undefined),
    };

    const handler = createGitHubInstallUrlHandler({
      app,
      store,
      runtime: createRuntime("https://promptforge.test/"),
    });

    await handler({
      auth: { userId: "user-2" },
      req: { headers: {} },
    });

    expect(app.createSetupState).toHaveBeenCalledWith({
      userId: "user-2",
      nonce: "nonce-2",
      returnTo: "https://promptforge.test/",
    });
  });

  it("keeps the configured return target for spoofed origins", async () => {
    const app = {
      createNonce: vi.fn(() => "nonce-3"),
      createSetupState: vi.fn(() => "signed-state"),
      buildInstallUrl: vi.fn(() => "https://github.com/apps/promptforge/installations/new?state=signed-state"),
    };
    const store = {
      createSetupState: vi.fn(async () => undefined),
    };

    const handler = createGitHubInstallUrlHandler({
      app,
      store,
      runtime: createRuntime("https://promptforge.test/"),
    });

    await handler({
      auth: { userId: "user-1" },
      req: {
        headers: {
          origin: "https://spoofed.example",
        },
      },
    });

    expect(app.createSetupState).toHaveBeenCalledWith({
      userId: "user-1",
      nonce: "nonce-3",
      returnTo: "https://promptforge.test/",
    });
  });

  it("does not rewrite the return target when CORS is wildcard mode", async () => {
    const app = {
      createNonce: vi.fn(() => "nonce-4"),
      createSetupState: vi.fn(() => "signed-state"),
      buildInstallUrl: vi.fn(() => "https://github.com/apps/promptforge/installations/new?state=signed-state"),
    };
    const store = {
      createSetupState: vi.fn(async () => undefined),
    };

    const handler = createGitHubInstallUrlHandler({
      app,
      store,
      runtime: createRuntime("https://promptforge.test/", {
        mode: "any",
        origins: new Set(),
      }),
    });

    await handler({
      auth: { userId: "user-1" },
      req: {
        headers: {
          origin: "http://localhost:8080",
        },
      },
    });

    expect(app.createSetupState).toHaveBeenCalledWith({
      userId: "user-1",
      nonce: "nonce-4",
      returnTo: "https://promptforge.test/",
    });
  });

  it("redirects the setup callback back to the signed return target", async () => {
    const app = {
      verifySetupState: vi.fn(() => ({
        userId: "user-1",
        nonce: "nonce-1",
        returnTo: "http://localhost:8080/?from=github",
      })),
      getInstallationDetails: vi.fn(async () => ({ id: 321 })),
    };
    const store = {
      consumeSetupState: vi.fn(async () => undefined),
      upsertInstallation: vi.fn(async () => undefined),
    };

    const handler = createGitHubSetupReturnHandler({
      app,
      store,
      runtime: createRuntime("https://promptforge.test/"),
    });

    const response = await handler({
      url: new URL("https://agent.test/github/app/setup?state=signed-state&installation_id=321"),
    });

    expect(store.consumeSetupState).toHaveBeenCalledWith({
      userId: "user-1",
      nonce: "nonce-1",
    });
    expect(store.upsertInstallation).toHaveBeenCalledWith("user-1", { id: 321 });
    expect(response).toEqual({
      status: 302,
      redirectTo: "http://localhost:8080/?from=github&github_setup=success",
    });
  });

  it("falls back to the configured redirect when the signed return target is invalid", async () => {
    const app = {
      verifySetupState: vi.fn(() => ({
        userId: "user-3",
        nonce: "nonce-3",
        returnTo: "not-a-valid-url",
      })),
      getInstallationDetails: vi.fn(async () => ({ id: 654 })),
    };
    const store = {
      consumeSetupState: vi.fn(async () => undefined),
      upsertInstallation: vi.fn(async () => undefined),
    };

    const handler = createGitHubSetupReturnHandler({
      app,
      store,
      runtime: createRuntime("https://promptforge.test/?view=builder"),
    });

    const response = await handler({
      url: new URL("https://agent.test/github/app/setup?state=signed-state&installation_id=654"),
    });

    expect(response).toEqual({
      status: 302,
      redirectTo: "https://promptforge.test/?view=builder&github_setup=success",
    });
  });
});
