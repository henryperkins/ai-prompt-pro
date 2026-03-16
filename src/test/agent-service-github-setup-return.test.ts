/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createGitHubSetupReturnHandler } from "../../agent_service/handlers/github-setup-return.mjs";

function createHandlerDeps() {
  return {
    app: {
      verifySetupState: vi.fn(),
      getInstallationDetails: vi.fn(),
    },
    store: {
      consumeSetupState: vi.fn(),
      upsertInstallation: vi.fn(),
    },
    runtime: {
      githubConfig: {
        postInstallRedirectUrl: "https://promptforge.test/builder",
      },
    },
  };
}

function createSetupUrl(query = "") {
  return new URL(`https://agent.test/github/app/setup${query}`);
}

describe("agent service GitHub setup return handler", () => {
  it("redirects successful installs back to the verified return URL", async () => {
    const deps = createHandlerDeps();
    deps.app.verifySetupState.mockReturnValue({
      userId: "user-123",
      nonce: "nonce-123",
      returnTo: "https://promptforge.test/builder?panel=github",
    });
    deps.app.getInstallationDetails.mockResolvedValue({ id: 42 });

    const handler = createGitHubSetupReturnHandler(deps);
    const response = await handler({
      url: createSetupUrl("?state=signed-state&installation_id=42"),
    });

    expect(deps.store.consumeSetupState).toHaveBeenCalledWith({
      userId: "user-123",
      nonce: "nonce-123",
    });
    expect(deps.store.upsertInstallation).toHaveBeenCalledWith("user-123", { id: 42 });
    expect(response).toEqual({
      status: 302,
      redirectTo: "https://promptforge.test/builder?panel=github&github_setup=success",
    });
  });

  it("returns incomplete-install errors to the verified return URL", async () => {
    const deps = createHandlerDeps();
    deps.app.verifySetupState.mockReturnValue({
      userId: "user-123",
      nonce: "nonce-123",
      returnTo: "https://promptforge.test/builder?panel=github",
    });

    const handler = createGitHubSetupReturnHandler(deps);
    const response = await handler({
      url: createSetupUrl("?state=signed-state"),
    });

    expect(deps.store.consumeSetupState).toHaveBeenCalledWith({
      userId: "user-123",
      nonce: "nonce-123",
    });
    expect(deps.app.getInstallationDetails).not.toHaveBeenCalled();
    expect(response).toEqual({
      status: 302,
      redirectTo: "https://promptforge.test/builder?panel=github&github_setup=error&github_message=GitHub+installation+was+not+completed.",
    });
  });

  it("does not leak state verification details in the redirect message", async () => {
    const deps = createHandlerDeps();
    deps.app.verifySetupState.mockImplementation(() => {
      const error = new Error("GitHub setup state signature is invalid.");
      error.code = "github_invalid_state";
      throw error;
    });

    const handler = createGitHubSetupReturnHandler(deps);
    const response = await handler({
      url: createSetupUrl("?state=invalid-state"),
    });

    expect(deps.store.consumeSetupState).not.toHaveBeenCalled();
    expect(response).toEqual({
      status: 302,
      redirectTo: "https://promptforge.test/builder?github_setup=error&github_message=GitHub+setup+could+not+be+verified.+Please+try+again.",
    });
  });
});
