import {
  createHmac,
  createPrivateKey,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT } from "jose";
import { createGitHubError } from "./github-errors.mjs";

const GITHUB_API_VERSION = "2022-11-28";
const CURRENT_GITHUB_API_VERSION = "2026-03-10";
const DEFAULT_API_BASE_URL = "https://api.github.com";
const STATE_TTL_SECONDS = 10 * 60;
const INSTALLATION_TOKEN_SKEW_MS = 60_000;

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeMultilineSecret(value) {
  const normalized = normalizeString(value);
  if (!normalized) return "";
  return normalized.replace(/\\n/g, "\n");
}

function toBase64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return buffer.toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(String(value || ""), "base64url");
}

function createStateSignature(input, secret) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function normalizeApiError(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload;
  const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
  if (!message) return fallback;
  const errors = Array.isArray(candidate.errors)
    ? candidate.errors
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const code = typeof entry.code === "string" ? entry.code.trim() : "";
        const field = typeof entry.field === "string" ? entry.field.trim() : "";
        return [field, code].filter(Boolean).join(": ");
      })
      .filter(Boolean)
    : [];
  return errors.length > 0 ? `${message} (${errors.join(", ")})` : message;
}

export function createGitHubAppClient(config = {}, deps = {}) {
  const {
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
  } = deps;
  const apiBaseUrl = normalizeString(config.apiBaseUrl) || DEFAULT_API_BASE_URL;
  const appId = normalizeString(config.appId);
  const appSlug = normalizeString(config.appSlug);
  const stateSecret = normalizeString(config.stateSecret);
  const webhookSecret = normalizeString(config.webhookSecret);
  const privateKeyPem = normalizeMultilineSecret(config.appPrivateKey);

  // --- Diagnostic: API version skew detection ---
  if (config.enabled && GITHUB_API_VERSION !== CURRENT_GITHUB_API_VERSION) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      event: "github_api_version_skew",
      message:
        `X-GitHub-Api-Version header is "${GITHUB_API_VERSION}" but the current GitHub API version is "${CURRENT_GITHUB_API_VERSION}". `
        + "Using an outdated API version may cause response schema differences, deprecation warnings, or missing fields.",
      configured_version: GITHUB_API_VERSION,
      current_version: CURRENT_GITHUB_API_VERSION,
    }));
  }
  // --- End diagnostic ---

  let cachedAppJwt = null;
  const installationTokenCache = new Map();
  let privateKey = null;

  function assertFeatureEnabled() {
    if (!config.enabled) {
      throw createGitHubError(
        "GitHub context is disabled.",
        "github_context_disabled",
        404,
      );
    }
  }

  function assertAppConfigured() {
    assertFeatureEnabled();
    if (!appId || !appSlug || !stateSecret || !privateKeyPem) {
      throw createGitHubError(
        "GitHub App credentials are not configured.",
        "github_config_unavailable",
        503,
      );
    }
  }

  function assertWebhookConfigured() {
    assertFeatureEnabled();
    if (!webhookSecret) {
      throw createGitHubError(
        "GitHub webhook secret is not configured.",
        "github_config_unavailable",
        503,
      );
    }
  }

  function getPrivateKey() {
    if (!privateKey) {
      privateKey = createPrivateKey({
        key: privateKeyPem,
        format: "pem",
      });
    }
    return privateKey;
  }

  async function getAppJwt() {
    assertAppConfigured();
    if (cachedAppJwt && cachedAppJwt.expiresAt > now() + INSTALLATION_TOKEN_SKEW_MS) {
      return cachedAppJwt.token;
    }

    const issuedAtSeconds = Math.floor(now() / 1000) - 30;
    const expiresAtSeconds = issuedAtSeconds + 9 * 60;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(expiresAtSeconds)
      .setIssuer(appId)
      .sign(getPrivateKey());

    cachedAppJwt = {
      token,
      expiresAt: expiresAtSeconds * 1000,
    };
    return token;
  }

  async function githubRequest(path, {
    method = "GET",
    headers,
    body,
    auth = "app",
    installationId,
  } = {}) {
    assertFeatureEnabled();
    if (typeof fetchImpl !== "function") {
      throw createGitHubError(
        "Fetch is unavailable for GitHub requests.",
        "github_unavailable",
        503,
      );
    }

    let bearerToken = "";
    if (auth === "app") {
      bearerToken = await getAppJwt();
    } else if (auth === "installation") {
      if (!Number.isFinite(installationId)) {
        throw createGitHubError(
          "GitHub installation ID is required.",
          "github_bad_request",
          400,
        );
      }
      bearerToken = await getInstallationAccessToken(installationId);
    } else if (typeof auth === "string" && auth.trim()) {
      bearerToken = auth.trim();
    }

    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: bearerToken ? `Bearer ${bearerToken}` : undefined,
        "Content-Type": body === undefined ? undefined : "application/json",
        "User-Agent": "PromptForge-GitHub-Integration",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const responseText = await response.text();
    const payload = responseText
      ? (() => {
        try {
          return JSON.parse(responseText);
        } catch {
          return responseText;
        }
      })()
      : null;

    if (!response.ok) {
      const retryAfterHeader = response.headers.get("retry-after");
      const remaining = response.headers.get("x-ratelimit-remaining");
      const isRateLimited =
        response.status === 429
        || (response.status === 403 && remaining === "0");
      throw createGitHubError(
        normalizeApiError(payload, `GitHub request failed with status ${response.status}.`),
        isRateLimited ? "github_rate_limited" : "github_request_failed",
        isRateLimited ? 429 : response.status,
      );
    }

    return {
      data: payload,
      headers: response.headers,
    };
  }

  async function getInstallationAccessToken(installationId) {
    assertAppConfigured();
    const cacheKey = String(installationId);
    const cached = installationTokenCache.get(cacheKey);
    if (cached && cached.expiresAt > now() + INSTALLATION_TOKEN_SKEW_MS) {
      return cached.token;
    }

    const response = await githubRequest(
      `/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        auth: "app",
        body: {},
      },
    );

    const token = normalizeString(response.data?.token);
    const expiresAtRaw = normalizeString(response.data?.expires_at);
    const expiresAt = Date.parse(expiresAtRaw);
    if (!token || !Number.isFinite(expiresAt)) {
      throw createGitHubError(
        "GitHub did not return a valid installation token.",
        "github_request_failed",
        502,
      );
    }

    installationTokenCache.set(cacheKey, {
      token,
      expiresAt,
    });
    return token;
  }

  function createSetupState({ userId, nonce, returnTo } = {}) {
    assertAppConfigured();
    const issuedAtSeconds = Math.floor(now() / 1000);
    const payload = {
      userId: normalizeString(userId),
      nonce: normalizeString(nonce) || randomUUID(),
      returnTo: normalizeString(returnTo),
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + STATE_TTL_SECONDS,
    };
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = createStateSignature(encodedPayload, stateSecret);
    return `${encodedPayload}.${signature}`;
  }

  function verifySetupState(token) {
    assertAppConfigured();
    const normalized = normalizeString(token);
    if (!normalized.includes(".")) {
      throw createGitHubError(
        "Missing or invalid GitHub setup state.",
        "github_invalid_state",
        400,
      );
    }

    const [encodedPayload, providedSignature] = normalized.split(".");
    const expectedSignature = createStateSignature(encodedPayload, stateSecret);
    const providedBuffer = Buffer.from(providedSignature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (
      providedBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw createGitHubError(
        "GitHub setup state signature is invalid.",
        "github_invalid_state",
        400,
      );
    }

    let payload = null;
    try {
      payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));
    } catch {
      throw createGitHubError(
        "GitHub setup state payload is invalid.",
        "github_invalid_state",
        400,
      );
    }

    if (!payload || typeof payload !== "object") {
      throw createGitHubError(
        "GitHub setup state payload is invalid.",
        "github_invalid_state",
        400,
      );
    }

    const expiresAtSeconds = Number(payload.exp);
    if (!Number.isFinite(expiresAtSeconds) || now() >= expiresAtSeconds * 1000) {
      throw createGitHubError(
        "GitHub setup state has expired.",
        "github_invalid_state",
        400,
      );
    }

    const userId = normalizeString(payload.userId);
    const nonce = normalizeString(payload.nonce);
    if (!userId || !nonce) {
      throw createGitHubError(
        "GitHub setup state is incomplete.",
        "github_invalid_state",
        400,
      );
    }

    return {
      userId,
      nonce,
      returnTo: normalizeString(payload.returnTo),
      expiresAt: expiresAtSeconds * 1000,
    };
  }

  function verifyWebhookSignature({ body, signature }) {
    assertWebhookConfigured();
    const normalizedSignature = normalizeString(signature);
    if (!normalizedSignature.startsWith("sha256=")) {
      throw createGitHubError(
        "GitHub webhook signature is missing or invalid.",
        "github_invalid_signature",
        401,
      );
    }

    const digest = createHmac("sha256", webhookSecret)
      .update(Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""), "utf8"))
      .digest("hex");
    const expected = Buffer.from(`sha256=${digest}`, "utf8");
    const provided = Buffer.from(normalizedSignature, "utf8");
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw createGitHubError(
        "GitHub webhook signature verification failed.",
        "github_invalid_signature",
        401,
      );
    }
    return true;
  }

  function buildInstallUrl({ state }) {
    assertAppConfigured();
    const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
    if (normalizeString(state)) {
      installUrl.searchParams.set("state", state);
    }
    return installUrl.toString();
  }

  async function getInstallationDetails(installationId) {
    const response = await githubRequest(`/app/installations/${installationId}`, {
      auth: "app",
    });
    return response.data;
  }

  async function getRepository(owner, repo, installationId) {
    const response = await githubRequest(`/repos/${owner}/${repo}`, {
      auth: "installation",
      installationId,
    });
    return response.data;
  }

  async function getRepositoryById(repositoryId, installationId) {
    const response = await githubRequest(`/repositories/${encodeURIComponent(repositoryId)}`, {
      auth: "installation",
      installationId,
    });
    return response.data;
  }

  async function getBranch(owner, repo, branch, installationId) {
    const response = await githubRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`, {
      auth: "installation",
      installationId,
    });
    return response.data;
  }

  async function getTree(owner, repo, treeSha, installationId, { recursive = false } = {}) {
    const response = await githubRequest(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(treeSha)}${recursive ? "?recursive=1" : ""}`,
      {
        auth: "installation",
        installationId,
      },
    );
    return response.data;
  }

  async function getBlob(owner, repo, blobSha, installationId) {
    const response = await githubRequest(
      `/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(blobSha)}`,
      {
        auth: "installation",
        installationId,
      },
    );
    return response.data;
  }

  async function listInstallationRepositories(installationId, {
    page = 1,
    perPage = 50,
  } = {}) {
    const response = await githubRequest(
      `/installation/repositories?per_page=${encodeURIComponent(perPage)}&page=${encodeURIComponent(page)}`,
      {
        auth: "installation",
        installationId,
      },
    );
    return response.data;
  }

  function createNonce() {
    return `${randomUUID()}${toBase64Url(randomBytes(8))}`;
  }

  return {
    buildInstallUrl,
    createNonce,
    createSetupState,
    getBlob,
    getBranch,
    getInstallationDetails,
    getRepository,
    getRepositoryById,
    getTree,
    listInstallationRepositories,
    verifySetupState,
    verifyWebhookSignature,
  };
}
