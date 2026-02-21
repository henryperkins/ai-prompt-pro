import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";

const CONFIG_PATH = join(homedir(), ".codex", "config.toml");

/**
 * @typedef {Object} ResolvedProviderConfig
 * @property {string} provider - Provider key (e.g. "azure", "openai")
 * @property {string} name - Human-readable provider name
 * @property {string} baseUrl - API base URL
 * @property {string} envKey - Environment variable name for the API key
 * @property {string} wireApi - Wire API format ("responses" | "chat")
 * @property {string} model - Default model from config.toml top-level or profile
 */

/**
 * Load and parse ~/.codex/config.toml, resolving the active model provider.
 *
 * @returns {ResolvedProviderConfig | null} Resolved provider config, or null if
 *   config.toml is missing or doesn't specify a model_provider.
 */
export async function loadCodexConfig() {
  let raw;
  try {
    raw = await readFile(CONFIG_PATH, "utf8");
  } catch {
    return null;
  }

  let config;
  try {
    config = parseToml(raw);
  } catch {
    return null;
  }

  const providerKey = typeof config.model_provider === "string"
    ? config.model_provider.trim()
    : "";
  if (!providerKey) return null;

  const model = typeof config.model === "string" ? config.model.trim() : "";

  const providers = config.model_providers;
  if (!providers || typeof providers !== "object") return null;

  const providerSection = providers[providerKey];
  if (!providerSection || typeof providerSection !== "object") return null;

  const name = typeof providerSection.name === "string"
    ? providerSection.name.trim()
    : providerKey;
  const baseUrl = typeof providerSection.base_url === "string"
    ? providerSection.base_url.trim()
    : "";
  const envKey = typeof providerSection.env_key === "string"
    ? providerSection.env_key.trim()
    : "";
  const wireApi = typeof providerSection.wire_api === "string"
    ? providerSection.wire_api.trim()
    : "";

  if (!baseUrl || !envKey) return null;

  return { provider: providerKey, name, baseUrl, envKey, wireApi, model };
}

/**
 * Resolve the API key for a provider config from the environment.
 *
 * @param {ResolvedProviderConfig} providerConfig
 * @returns {string | null}
 */
export function resolveApiKey(providerConfig) {
  if (!providerConfig?.envKey) return null;
  const value = process.env[providerConfig.envKey];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Check whether the resolved provider is Azure-based.
 *
 * @param {ResolvedProviderConfig | null} providerConfig
 * @returns {boolean}
 */
export function isAzureProvider(providerConfig) {
  if (!providerConfig) return false;
  return providerConfig.provider.toLowerCase().startsWith("azure");
}
