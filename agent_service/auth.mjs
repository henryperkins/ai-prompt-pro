import { createRemoteJWKSet, jwtVerify } from "jose";
import { isConfiguredPublicApiKey as matchesConfiguredPublicApiKey } from "./public-api-key.mjs";
import {
  normalizeEnvValue as _normalizeEnvValue,
  normalizeBool,
  parseStringArrayValue,
} from "./env-parse.mjs";
import { headerValue } from "./http-helpers.mjs";

export const DEFAULT_ROUTE_AUTH_POLICY = Object.freeze({
  allowPublicKey: true,
  allowServiceToken: true,
  allowUserJwt: true,
});

/**
 * Read an env value from a custom source object.
 *
 * @param {Record<string, string | undefined>} source
 * @param {string} name
 * @returns {string | undefined}
 */
function normalizeEnvValue(source, name) {
  return _normalizeEnvValue(name, source);
}

function parseBearerToken(req) {
  const authHeader = headerValue(req, "authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function normalizeNeonAuthUrl(rawValue) {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!raw) return undefined;

  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/auth/v1")) {
    return trimmed.slice(0, -"/v1".length);
  }
  return trimmed;
}

function isProductionEnvironment(env) {
  if (normalizeEnvValue(env, "DENO_DEPLOYMENT_ID")) return true;

  const envValue = (
    normalizeEnvValue(env, "APP_ENV")
    || normalizeEnvValue(env, "ENVIRONMENT")
    || normalizeEnvValue(env, "NODE_ENV")
    || ""
  )
    .trim()
    .toLowerCase();

  return envValue === "prod" || envValue === "production";
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function numericClaim(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectBooleanFlag(source, key) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return false;
  return source[key] === true;
}

function decodeUserFromJwt(token, now) {
  const claims = decodeJwtPayload(token.trim());
  if (!claims) return null;

  const subject = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!subject) return null;

  const exp = numericClaim(claims.exp);
  if (exp !== null && now() >= exp * 1000) return null;

  const isAnonymous = (
    claims.role === "anon"
    || claims.is_anonymous === true
    || objectBooleanFlag(claims.app_metadata, "is_anonymous")
    || objectBooleanFlag(claims.user_metadata, "is_anonymous")
  );

  return {
    id: subject,
    isAnonymous,
  };
}

function looksLikeJwt(value) {
  return typeof value === "string" && value.split(".").length === 3;
}

function toErrorMessage(error) {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  return String(error || "Unexpected auth error.");
}

export function resolveAuthConfig(env = process.env) {
  const neonAuthUrl = normalizeNeonAuthUrl(normalizeEnvValue(env, "NEON_AUTH_URL"));
  const neonJwksUrl = normalizeEnvValue(env, "NEON_JWKS_URL")
    || (neonAuthUrl ? `${neonAuthUrl}/.well-known/jwks.json` : undefined);

  const configuredPublicApiKeyValues = [
    normalizeEnvValue(env, "FUNCTION_PUBLIC_API_KEY"),
    normalizeEnvValue(env, "NEON_PUBLISHABLE_KEY"),
    normalizeEnvValue(env, "VITE_NEON_PUBLISHABLE_KEY"),
  ].filter((value) => typeof value === "string" && value.length > 0);

  const explicitAuthApiKey = normalizeEnvValue(env, "NEON_AUTH_API_KEY");
  const neonPublishableKey = normalizeEnvValue(env, "NEON_PUBLISHABLE_KEY");
  const viteNeonPublishableKey = normalizeEnvValue(env, "VITE_NEON_PUBLISHABLE_KEY");
  const authValidationApiKey = explicitAuthApiKey || neonPublishableKey || viteNeonPublishableKey;
  const authValidationApiKeySource = explicitAuthApiKey
    ? "NEON_AUTH_API_KEY"
    : neonPublishableKey
      ? "NEON_PUBLISHABLE_KEY"
      : viteNeonPublishableKey
        ? "VITE_NEON_PUBLISHABLE_KEY"
        : undefined;

  const configuredAudiences = parseStringArrayValue(normalizeEnvValue(env, "NEON_AUTH_AUDIENCE"));

  return {
    neonAuthUrl,
    neonJwksUrl,
    neonAuthUserUrl: neonAuthUrl ? `${neonAuthUrl}/v1/user` : undefined,
    authValidationApiKey,
    authValidationApiKeySource,
    configuredPublicApiKeys: new Set(configuredPublicApiKeyValues),
    audiences: configuredAudiences,
  };
}

export function createAuthService({
  env = process.env,
  authConfig = resolveAuthConfig(env),
  strictPublicApiKey = true,
  serviceToken,
  getClientIp,
  logEvent = () => undefined,
  fetchImpl = globalThis.fetch,
  createRemoteJWKSetImpl = createRemoteJWKSet,
  jwtVerifyImpl = jwtVerify,
  now = () => Date.now(),
} = {}) {
  if (typeof getClientIp !== "function") {
    throw new Error("createAuthService requires getClientIp.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("createAuthService requires fetchImpl.");
  }

  let neonJwksResolver = null;
  let hasLoggedAuthConfigWarning = false;
  let hasLoggedJwtFallbackWarning = false;
  let hasLoggedJwtFallbackProductionWarning = false;

  function allowUnverifiedJwtFallback() {
    if (!normalizeBool(env?.ALLOW_UNVERIFIED_JWT_FALLBACK, false)) {
      return false;
    }

    if (!isProductionEnvironment(env)) {
      return true;
    }

    if (normalizeBool(env?.ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION, false)) {
      return true;
    }

    if (!hasLoggedJwtFallbackProductionWarning) {
      hasLoggedJwtFallbackProductionWarning = true;
      logEvent("error", "auth_config_warning", {
        error_code: "auth_config_invalid",
        message:
          "ALLOW_UNVERIFIED_JWT_FALLBACK is ignored in production by default. "
          + "Set ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION=true only for emergency recovery scenarios.",
      });
    }

    return false;
  }

  function isConfiguredPublicApiKey(value) {
    return matchesConfiguredPublicApiKey(value, {
      configuredKeys: authConfig.configuredPublicApiKeys,
      strict: strictPublicApiKey,
    });
  }

  function tryDecodeUserFromJwtFallback(bearerToken, reason) {
    if (!allowUnverifiedJwtFallback() || !looksLikeJwt(bearerToken)) return null;
    const decodedUser = decodeUserFromJwt(bearerToken, now);
    if (!decodedUser) return null;

    if (!hasLoggedJwtFallbackWarning) {
      hasLoggedJwtFallbackWarning = true;
      logEvent("warn", "auth_fallback_enabled", {
        error_code: "auth_fallback_unverified_jwt",
        reason,
        message:
          `ALLOW_UNVERIFIED_JWT_FALLBACK is enabled; accepting decoded JWT claims without signature verification (${reason}).`,
      });
    }

    return decodedUser;
  }

  function getNeonJwksResolver() {
    if (!authConfig.neonJwksUrl) return null;
    if (!neonJwksResolver) {
      neonJwksResolver = createRemoteJWKSetImpl(new URL(authConfig.neonJwksUrl));
    }
    return neonJwksResolver;
  }

  async function verifyNeonJwt(token) {
    const jwks = getNeonJwksResolver();
    if (!jwks) {
      return { ok: false, reason: "config" };
    }

    try {
      const verifyOptions = {};
      if (authConfig.neonAuthUrl) {
        verifyOptions.issuer = authConfig.neonAuthUrl;
      }
      if (Array.isArray(authConfig.audiences) && authConfig.audiences.length > 0) {
        verifyOptions.audience = authConfig.audiences.length === 1
          ? authConfig.audiences[0]
          : authConfig.audiences;
      }

      const { payload } = await jwtVerifyImpl(token, jwks, verifyOptions);
      const userId = typeof payload.sub === "string" ? payload.sub.trim() : "";
      if (!userId) {
        return { ok: false, reason: "invalid" };
      }

      return { ok: true, userId, authMode: "user_jwt" };
    } catch (error) {
      const message = toErrorMessage(error).toLowerCase();
      if (message.includes("failed to fetch") || message.includes("network")) {
        return { ok: false, reason: "unavailable" };
      }
      return { ok: false, reason: "invalid" };
    }
  }

  async function verifyNeonSessionWithAuthApi(token) {
    if (!authConfig.neonAuthUserUrl || !authConfig.authValidationApiKey) {
      return { ok: false, reason: "config" };
    }

    try {
      const response = await fetchImpl(authConfig.neonAuthUserUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: authConfig.authValidationApiKey,
        },
      });

      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: "invalid" };
      }
      if (!response.ok) {
        return { ok: false, reason: "unavailable" };
      }

      const data = await response.json().catch(() => null);
      const userId = typeof data?.id === "string" ? data.id.trim() : "";
      if (!userId) {
        return { ok: false, reason: "invalid" };
      }
      return { ok: true, userId, authMode: "user_session" };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  function buildAuthenticatedUserResult(userId, authMode) {
    return {
      ok: true,
      userId,
      isPublicKey: false,
      rateKey: userId,
      authMode,
    };
  }

  function buildPublicApiKeyAuthResult(apiKey, clientIp, policy) {
    if (!policy?.allowPublicKey || !isConfiguredPublicApiKey(apiKey)) return null;
    return {
      ok: true,
      userId: null,
      isPublicKey: true,
      rateKey: `public:${clientIp}`,
      authMode: "public_key",
    };
  }

  function buildAuthUnavailableResult({ bearerToken, reason, message, clientIp, apiKey, policy }) {
    if (!bearerToken) {
      const publicApiResult = buildPublicApiKeyAuthResult(apiKey, clientIp, policy);
      if (publicApiResult) return publicApiResult;
    }

    const fallbackUser = tryDecodeUserFromJwtFallback(bearerToken, reason);
    if (fallbackUser) {
      return buildAuthenticatedUserResult(fallbackUser.id, "jwt_fallback");
    }

    if (reason === "missing_config" && !hasLoggedAuthConfigWarning) {
      hasLoggedAuthConfigWarning = true;
      logEvent("error", "auth_config_warning", {
        error_code: "auth_config_missing",
        message:
          "NEON_AUTH_URL or NEON_JWKS_URL is required to validate bearer tokens. "
          + "Set one of those env vars, configure NEON_AUTH_API_KEY (or NEON_PUBLISHABLE_KEY) "
          + "for Neon session validation, provide FUNCTION_PUBLIC_API_KEY for explicit anonymous access, "
          + "or enable ALLOW_UNVERIFIED_JWT_FALLBACK for local development only.",
      });
    }

    return {
      ok: false,
      status: 503,
      error: message,
    };
  }

  async function requireAuthenticatedUser(req, requestContext, policy = DEFAULT_ROUTE_AUTH_POLICY) {
    if (policy?.allowUserJwt === false) {
      return {
        ok: false,
        status: 401,
        error: "Sign in required.",
      };
    }

    const bearerToken = parseBearerToken(req);
    const apiKey = (headerValue(req, "apikey") || "").trim();
    const clientIp = getClientIp(req, requestContext);

    if (!bearerToken) {
      const publicApiResult = buildPublicApiKeyAuthResult(apiKey, clientIp, policy);
      if (publicApiResult) return publicApiResult;
      return {
        ok: false,
        status: 401,
        error: "Missing bearer token.",
      };
    }

    if (!looksLikeJwt(bearerToken)) {
      const authApiVerification = await verifyNeonSessionWithAuthApi(bearerToken);
      if (authApiVerification.ok) {
        return buildAuthenticatedUserResult(authApiVerification.userId, authApiVerification.authMode);
      }
      if (authApiVerification.reason === "config") {
        return buildAuthUnavailableResult({
          bearerToken,
          reason: "missing_config",
          message: "Authentication service is unavailable because Neon auth is not configured.",
          clientIp,
          apiKey,
          policy,
        });
      }
      if (authApiVerification.reason === "unavailable") {
        return buildAuthUnavailableResult({
          bearerToken,
          reason: "auth_unavailable",
          message: "Authentication service is temporarily unavailable. Please try again.",
          clientIp,
          apiKey,
          policy,
        });
      }

      return {
        ok: false,
        status: 401,
        error: "Invalid or expired auth session.",
      };
    }

    const verified = await verifyNeonJwt(bearerToken);
    if (verified.ok) {
      return buildAuthenticatedUserResult(verified.userId, verified.authMode);
    }

    const authApiVerification = await verifyNeonSessionWithAuthApi(bearerToken);
    if (authApiVerification.ok) {
      return buildAuthenticatedUserResult(authApiVerification.userId, authApiVerification.authMode);
    }

    if (verified.reason === "invalid" || authApiVerification.reason === "invalid") {
      return {
        ok: false,
        status: 401,
        error: "Invalid or expired auth session.",
      };
    }

    if (verified.reason === "unavailable" || authApiVerification.reason === "unavailable") {
      return buildAuthUnavailableResult({
        bearerToken,
        reason: "auth_unavailable",
        message: "Authentication service is temporarily unavailable. Please try again.",
        clientIp,
        apiKey,
        policy,
      });
    }

    if (verified.reason === "config" || authApiVerification.reason === "config") {
      return buildAuthUnavailableResult({
        bearerToken,
        reason: "missing_config",
        message: "Authentication service is unavailable because Neon auth is not configured.",
        clientIp,
        apiKey,
        policy,
      });
    }

    return {
      ok: false,
      status: 401,
      error: "Invalid or expired auth session.",
    };
  }

  async function authenticateRequestContext(req, requestContext, policy = DEFAULT_ROUTE_AUTH_POLICY) {
    const providedServiceToken = (headerValue(req, "x-agent-token") || "").trim();
    if (providedServiceToken) {
      if (!policy?.allowServiceToken) {
        return {
          ok: false,
          status: 401,
          error: "Invalid or missing service token.",
        };
      }
      if (!serviceToken || providedServiceToken !== serviceToken) {
        return {
          ok: false,
          status: 401,
          error: "Invalid or missing service token.",
        };
      }
      return {
        ok: true,
        userId: "service",
        isPublicKey: false,
        rateKey: `service:${getClientIp(req, requestContext)}`,
        authMode: "service_token",
      };
    }

    return requireAuthenticatedUser(req, requestContext, policy);
  }

  function getReadiness() {
    const authModes = [];
    const warnings = [];
    const issues = [];

    const publicKeyEnabled = authConfig.configuredPublicApiKeys.size > 0 || strictPublicApiKey === false;
    const serviceTokenEnabled = typeof serviceToken === "string" && serviceToken.trim().length > 0;
    const jwtValidationConfigured = Boolean(authConfig.neonJwksUrl);
    const sessionValidationConfigured = Boolean(authConfig.neonAuthUserUrl && authConfig.authValidationApiKey);
    const jwtFallbackEnabled = allowUnverifiedJwtFallback();

    if (jwtValidationConfigured || sessionValidationConfigured || jwtFallbackEnabled) {
      authModes.push("user_jwt");
    }
    if (publicKeyEnabled) {
      authModes.push("public_key");
    }
    if (serviceTokenEnabled) {
      authModes.push("service_token");
    }

    if (!jwtValidationConfigured && !sessionValidationConfigured && !jwtFallbackEnabled) {
      warnings.push("user_auth_validation_unconfigured");
    }
    if (authConfig.neonAuthUserUrl && !authConfig.authValidationApiKey) {
      warnings.push("neon_auth_api_key_missing");
    }
    if (authModes.length === 0) {
      issues.push("no_auth_mode_configured");
    }

    return {
      ok: issues.length === 0,
      issues,
      warnings,
      authModes,
      publicKeyEnabled,
      serviceTokenEnabled,
      jwtValidationConfigured,
      sessionValidationConfigured,
      jwtFallbackEnabled,
      authValidationApiKeySource: authConfig.authValidationApiKeySource,
      audienceCount: authConfig.audiences?.length ?? 0,
    };
  }

  function getStartupSummary() {
    const readiness = getReadiness();
    return {
      auth_modes: readiness.authModes,
      auth_public_key_enabled: readiness.publicKeyEnabled,
      auth_service_token_enabled: readiness.serviceTokenEnabled,
      auth_jwt_validation_configured: readiness.jwtValidationConfigured,
      auth_session_validation_configured: readiness.sessionValidationConfigured,
      auth_jwt_fallback_enabled: readiness.jwtFallbackEnabled,
      auth_validation_api_key_source: readiness.authValidationApiKeySource,
      auth_audience_count: readiness.audienceCount,
      auth_warnings: readiness.warnings.length > 0 ? readiness.warnings.join(",") : undefined,
    };
  }

  return {
    authConfig,
    authenticateRequestContext,
    requireAuthenticatedUser,
    isConfiguredPublicApiKey,
    getReadiness,
    getStartupSummary,
  };
}
