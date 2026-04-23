import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createServiceRuntime,
  sanitizeCodexExecErrorMessage,
} from "../../agent_service/service-runtime.mjs";

function createStubDeps(overrides: Record<string, unknown> = {}) {
  const authService = {
    authenticateRequestContext: vi.fn(),
    getReadiness: vi.fn(() => ({
      issues: [],
      warnings: [],
      activeSessionValidationConfigured: true,
      sessionValidationConfigured: true,
      sessionValidationMode: "worker",
    })),
    getStartupSummary: vi.fn(() => ({ auth_summary: "configured" })),
  };

  class FakeCodex {
    options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  }

  return {
    authService,
    deps: {
      CodexClass: FakeCodex,
      bindAbortControllersImpl: vi.fn(),
      createAuthServiceImpl: vi.fn(() => authService),
      createConnectionSlotTrackerImpl: vi.fn(() => ({
        acquire: vi.fn(() => true),
        release: vi.fn(),
      })),
      createExtractUrlCacheImpl: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
      })),
      createRateLimiterImpl: vi.fn(() => ({
        check: vi.fn(() => ({ ok: true })),
      })),
      isAzureProviderImpl: vi.fn(() => false),
      loadCodexConfigImpl: vi.fn(async () => null),
      logEventImpl: vi.fn(),
      normalizeIpAddressImpl: vi.fn((value: string) => value),
      resolveAuthConfigImpl: vi.fn(() => ({ authValidationApiKeySource: "NEON_PUBLISHABLE_KEY" })),
      resolveClientIpImpl: vi.fn(() => ({
        ip: "198.51.100.10",
        ignoredForwarded: false,
        forwardedIp: undefined,
        socketIp: "198.51.100.10",
      })),
      resolveProviderConfigImpl: vi.fn(() => null),
      ...overrides,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("agent service runtime extraction", () => {
  it("keeps the Azure deployment guard when no deployment-backed model is resolved", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const providerConfig = {
      provider: "azure-openai",
      name: "Azure OpenAI",
      baseUrl: "https://example-resource.openai.azure.com/openai/v1",
      envKey: "AZURE_OPENAI_API_KEY",
      model: "",
    };
    const { deps } = createStubDeps({
      isAzureProviderImpl: vi.fn(() => true),
      loadCodexConfigImpl: vi.fn(async () => providerConfig),
      logEventImpl: vi.fn(),
    });

    const runtime = await createServiceRuntime({
      env: {
        AZURE_OPENAI_API_KEY: "azure-test-key",
      },
      deps,
    });

    expect(runtime.hasMissingAzureModel).toBe(true);
    expect(runtime.resolvedCodexModel).toBeUndefined();
    expect(runtime.defaultThreadOptions).not.toHaveProperty("model");
    expect(runtime.extractModel).toBeUndefined();
    expect(runtime.inferModel).toBeUndefined();
    expect(runtime.buildReadinessReport().issues).toContain("provider_model_missing");
    expect(deps.logEventImpl).toHaveBeenCalledWith(
      "warn",
      "provider_model_not_set",
      expect.objectContaining({
        error_code: "provider_model_not_set",
        provider: "azure-openai",
      }),
    );
  });

  it("sanitizes Codex stderr into actionable deployment and credential errors", () => {
    expect(
      sanitizeCodexExecErrorMessage(
        "Codex Exec exited with code 1: Reading prompt from stdin\nAPI deployment demo does not exist",
      ),
    ).toContain("configured Azure model deployment was not found");

    expect(
      sanitizeCodexExecErrorMessage(
        "Codex Exec exited with code 1: Reading prompt from stdin\nNo API key was supplied",
      ),
    ).toContain("provider credentials are missing or invalid");

    expect(
      sanitizeCodexExecErrorMessage("Failure at /home/azureuser/private/project"),
    ).toBe("Failure at [path]");
  });

  it("keeps provider-configured Codex clients on the CLI config path and caches the singleton", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const providerConfig = {
      provider: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      envKey: "OPENAI_API_KEY",
      model: "gpt-5.4",
    };
    const { deps } = createStubDeps({
      loadCodexConfigImpl: vi.fn(async () => providerConfig),
    });

    const runtime = await createServiceRuntime({
      env: {
        OPENAI_API_KEY: "sk-test",
      },
      deps,
    });

    expect(runtime.defaultCodexOptions).not.toHaveProperty("baseUrl");
    expect(runtime.defaultCodexOptions).not.toHaveProperty("apiKey");
    expect(runtime.defaultCodexOptions.config).toMatchObject({
      model_provider: "openai",
      model_reasoning_summary: "detailed",
    });

    const clientA = runtime.getCodexClient() as { options: unknown };
    const clientB = runtime.getCodexClient();

    expect(clientA).toBe(clientB);
    expect(clientA.options).toEqual(runtime.defaultCodexOptions);
  });

  it("builds runtime-truth health details and readiness snapshots from runtime config", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { deps, authService } = createStubDeps({
      logEventImpl: vi.fn(),
    });
    authService.getReadiness.mockReturnValue({
      issues: [],
      warnings: ["jwt_fallback_enabled"],
    });

    const runtime = await createServiceRuntime({
      env: {
        OPENAI_API_KEY: "sk-test",
        OPENAI_BASE_URL: "https://api.example.com/v1",
        STRICT_PUBLIC_API_KEY: "false",
      },
      deps,
    });

    expect(runtime.defaultCodexOptions).toMatchObject({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
    });
    expect(runtime.buildHealthDetails()).toMatchObject({
      provider_source: "fallback",
      provider_name: "OpenAI",
      provider_base_url: "https://api.example.com/v1",
      strict_public_api_key: false,
      trust_proxy: false,
    });
    expect(runtime.buildReadinessReport()).toMatchObject({
      ok: true,
      provider: "codex-sdk",
      warnings: ["jwt_fallback_enabled"],
      rate_limit_backend: "memory",
    });
    expect(deps.logEventImpl).toHaveBeenCalledWith(
      "warn",
      "strict_public_api_key_disabled",
      expect.objectContaining({
        error_code: "auth_config_weak_public_key_matching",
      }),
    );
  });

  it("logs ignored forwarded IPs when trust proxy is disabled", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { deps } = createStubDeps({
      logEventImpl: vi.fn(),
      resolveClientIpImpl: vi.fn(() => ({
        ip: "198.51.100.10",
        ignoredForwarded: true,
        forwardedIp: "203.0.113.20",
        socketIp: "198.51.100.10",
      })),
    });

    const runtime = await createServiceRuntime({
      env: {},
      deps,
    });

    const request = {
      headers: {
        "x-forwarded-for": "203.0.113.20",
      },
      socket: {
        remoteAddress: "198.51.100.10",
      },
    };
    const requestContext = {
      requestId: "req_runtime_test",
      endpoint: "/enhance",
    };

    expect(runtime.getClientIp(request, requestContext)).toBe("198.51.100.10");
    expect(deps.logEventImpl).toHaveBeenCalledWith(
      "warn",
      "forwarded_ip_ignored",
      expect.objectContaining({
        request_id: "req_runtime_test",
        endpoint: "/enhance",
        forwarded_ip: "203.0.113.20",
        reason: "trust_proxy_disabled",
      }),
    );
  });

  it("parses GitHub runtime config and exposes a strict user-only auth policy", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { deps } = createStubDeps();

    const runtime = await createServiceRuntime({
      env: {
        OPENAI_API_KEY: "sk-test",
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
        GITHUB_APP_SLUG: "promptforge-app",
        GITHUB_APP_STATE_SECRET: "state-secret",
        GITHUB_DEBUG_LOGGING: "true",
        GITHUB_WEBHOOK_SECRET: "webhook-secret",
        GITHUB_POST_INSTALL_REDIRECT_URL: "https://promptforge.test/builder",
        NEON_DATABASE_URL: "postgres://promptforge:test@db.example.neon.tech/neondb",
      },
      deps,
    });

    expect(runtime.githubConfig).toMatchObject({
      configured: true,
      appId: "12345",
      appSlug: "promptforge-app",
      debug: true,
      postInstallRedirectUrl: "https://promptforge.test/builder",
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
    });
    expect(runtime.githubUserAuthPolicy).toEqual({
      allowPublicKey: false,
      allowServiceToken: false,
      allowUserJwt: true,
      requireActiveSession: true,
    });
    expect(runtime.buildHealthDetails()).toMatchObject({
      github_context_configured: true,
      github_context_available: true,
    });
    expect(runtime.buildReadinessReport().warnings).not.toContain("github_config_incomplete");
  });

  it("fails readiness when GitHub context is configured without active session validation", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { deps, authService } = createStubDeps();
    authService.getReadiness.mockReturnValue({
      issues: [],
      warnings: [],
      activeSessionValidationConfigured: false,
      sessionValidationConfigured: false,
      sessionValidationMode: undefined,
    });

    const runtime = await createServiceRuntime({
      env: {
        OPENAI_API_KEY: "sk-test",
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
        GITHUB_APP_SLUG: "promptforge-app",
        GITHUB_APP_STATE_SECRET: "state-secret",
        GITHUB_WEBHOOK_SECRET: "webhook-secret",
        GITHUB_POST_INSTALL_REDIRECT_URL: "https://promptforge.test/builder",
        NEON_DATABASE_URL: "postgres://promptforge:test@db.example.neon.tech/neondb",
      },
      deps,
    });

    expect(runtime.buildReadinessReport()).toMatchObject({
      ok: false,
    });
    expect(runtime.buildReadinessReport().issues).toContain("github_user_session_validation_missing");
  });

  it("defaults GitHub debug logging to false", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { deps } = createStubDeps();

    const runtime = await createServiceRuntime({
      env: {
        OPENAI_API_KEY: "sk-test",
      },
      deps,
    });

    expect(runtime.githubConfig.debug).toBe(false);
  });
});
