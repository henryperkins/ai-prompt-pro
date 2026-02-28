import { describe, expect, it } from "vitest";
import {
  resolveProviderConfig,
  resolveApiKey,
  isAzureProvider,
} from "../../agent_service/codex-config.mjs";

describe("resolveProviderConfig", () => {
  it("returns null for null/undefined/non-object", () => {
    expect(resolveProviderConfig(null)).toBeNull();
    expect(resolveProviderConfig(undefined)).toBeNull();
    expect(resolveProviderConfig("string")).toBeNull();
    expect(resolveProviderConfig(42)).toBeNull();
    expect(resolveProviderConfig([])).toBeNull();
  });

  it("returns null when model_provider is missing", () => {
    expect(resolveProviderConfig({ model_providers: {} })).toBeNull();
  });

  it("returns null when model_providers is missing", () => {
    expect(resolveProviderConfig({ model_provider: "openai" })).toBeNull();
  });

  it("returns null when provider section is missing base_url or env_key", () => {
    expect(
      resolveProviderConfig({
        model_provider: "openai",
        model_providers: {
          openai: { name: "OpenAI", base_url: "", env_key: "OPENAI_API_KEY" },
        },
      }),
    ).toBeNull();

    expect(
      resolveProviderConfig({
        model_provider: "openai",
        model_providers: {
          openai: { name: "OpenAI", base_url: "https://api.openai.com/v1", env_key: "" },
        },
      }),
    ).toBeNull();
  });

  it("returns resolved config for valid input", () => {
    const result = resolveProviderConfig({
      model_provider: "azure",
      model: "gpt-4o",
      model_providers: {
        azure: {
          name: "Azure OpenAI",
          base_url: "https://myaccount.openai.azure.com/openai/v1",
          env_key: "AZURE_OPENAI_API_KEY",
          wire_api: "responses",
        },
      },
    });

    expect(result).toEqual({
      provider: "azure",
      name: "Azure OpenAI",
      baseUrl: "https://myaccount.openai.azure.com/openai/v1",
      envKey: "AZURE_OPENAI_API_KEY",
      wireApi: "responses",
      model: "gpt-4o",
    });
  });
});

describe("resolveApiKey", () => {
  it("returns null for null config", () => {
    expect(resolveApiKey(null)).toBeNull();
  });

  it("returns null when env var is not set", () => {
    expect(resolveApiKey({ envKey: "NONEXISTENT_TEST_KEY_12345" })).toBeNull();
  });
});

describe("isAzureProvider", () => {
  it("returns true for azure provider", () => {
    expect(isAzureProvider({ provider: "azure" })).toBe(true);
    expect(isAzureProvider({ provider: "azure-openai" })).toBe(true);
  });

  it("returns false for non-azure provider", () => {
    expect(isAzureProvider({ provider: "openai" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAzureProvider(null)).toBe(false);
  });
});
