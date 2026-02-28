import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const URL_NOT_ALLOWED_ERROR_CODE = "url_not_allowed";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function unwrapIpv6Brackets(value) {
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1);
  }
  return value;
}

export function normalizeIpAddress(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const unwrapped = unwrapIpv6Brackets(trimmed);
  if (unwrapped.startsWith("::ffff:")) {
    return unwrapped.slice("::ffff:".length);
  }
  return unwrapped;
}

export function isPrivateIpAddress(ipAddress) {
  const normalized = normalizeIpAddress(ipAddress);
  if (!normalized) return false;

  if (
    normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fe80:")
    || normalized.startsWith("fc00:")
    || normalized.startsWith("fd")
  ) {
    return true;
  }

  const ipv4Match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const [, a, b] = ipv4Match.map(Number);
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

export function isPrivateHost(hostname) {
  if (typeof hostname !== "string") return false;
  const normalizedHost = hostname.trim().toLowerCase();
  if (!normalizedHost) return false;

  if (
    normalizedHost === "metadata.google.internal"
    || normalizedHost === "metadata.google"
    || normalizedHost.endsWith(".internal")
  ) {
    return true;
  }

  const bareHost = unwrapIpv6Brackets(normalizedHost);
  if (isPrivateIpAddress(bareHost)) return true;

  if (normalizedHost === "localhost" || normalizedHost.endsWith(".localhost")) {
    return true;
  }

  return false;
}

export function createUrlNotAllowedError(message) {
  const error = new Error(message);
  error.code = URL_NOT_ALLOWED_ERROR_CODE;
  return error;
}

export function isUrlNotAllowedError(error) {
  if (!error || typeof error !== "object") return false;
  return error.code === URL_NOT_ALLOWED_ERROR_CODE;
}

function parseFirstHop(forwardedFor) {
  if (typeof forwardedFor !== "string") return null;
  const [firstHop] = forwardedFor.split(",");
  return normalizeIpAddress(firstHop || "");
}

export function resolveClientIp({
  forwardedFor,
  realIp,
  socketRemoteAddress,
  trustProxy = false,
  trustedProxyIps = new Set(),
}) {
  const forwardedIp = parseFirstHop(forwardedFor);
  const normalizedRealIp = normalizeIpAddress(realIp || "");
  const socketIp = normalizeIpAddress(socketRemoteAddress || "");

  const trustedProxySet = trustedProxyIps instanceof Set
    ? trustedProxyIps
    : new Set(
      Array.isArray(trustedProxyIps)
        ? trustedProxyIps.map((entry) => normalizeIpAddress(entry)).filter(Boolean)
        : [],
    );

  const isTrustedProxy = Boolean(trustProxy)
    && (
      trustedProxySet.size === 0
      || (socketIp && trustedProxySet.has(socketIp))
    );

  if (isTrustedProxy) {
    if (forwardedIp) {
      return {
        ip: forwardedIp,
        forwardedIp,
        realIp: normalizedRealIp,
        socketIp,
        ignoredForwarded: false,
      };
    }
    if (normalizedRealIp) {
      return {
        ip: normalizedRealIp,
        forwardedIp,
        realIp: normalizedRealIp,
        socketIp,
        ignoredForwarded: false,
      };
    }
  }

  const fallbackIp = socketIp || normalizedRealIp || forwardedIp || "unknown";
  return {
    ip: fallbackIp,
    forwardedIp,
    realIp: normalizedRealIp,
    socketIp,
    ignoredForwarded: Boolean(forwardedIp || normalizedRealIp) && !isTrustedProxy,
  };
}

async function resolveAddresses(hostname, lookupFn) {
  const records = await lookupFn(hostname, { all: true, verbatim: true });
  if (Array.isArray(records)) {
    return records
      .map((record) => normalizeIpAddress(record?.address || ""))
      .filter(Boolean);
  }
  const normalized = normalizeIpAddress(records?.address || "");
  return normalized ? [normalized] : [];
}

export async function assertPublicHttpTarget(urlString, options = {}) {
  const { lookupFn = lookup } = options;

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw createUrlNotAllowedError("Invalid URL format.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw createUrlNotAllowedError("Only http and https URLs are allowed.");
  }

  if (isPrivateHost(parsed.hostname)) {
    throw createUrlNotAllowedError("URLs pointing to private or internal hosts are not allowed.");
  }

  if (isIP(parsed.hostname) !== 0) {
    return parsed;
  }

  const resolvedAddresses = await resolveAddresses(parsed.hostname, lookupFn);
  if (resolvedAddresses.length === 0) {
    throw createUrlNotAllowedError("Could not resolve target hostname.");
  }

  if (resolvedAddresses.some((address) => isPrivateIpAddress(address))) {
    throw createUrlNotAllowedError("URLs pointing to private or internal hosts are not allowed.");
  }

  return parsed;
}

export function isRedirectStatus(statusCode) {
  return REDIRECT_STATUSES.has(statusCode);
}
