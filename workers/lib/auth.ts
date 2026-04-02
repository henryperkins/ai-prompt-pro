/**
 * Auth utilities for Cloudflare Workers
 * JWT signing/verification, password hashing, session management
 */

import { timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ============================================================
// Password Hashing (using Web Crypto API - PBKDF2)
// ============================================================

const ITERATIONS = 100000;
const HASH_LENGTH = 32; // 256 bits

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive key
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: ITERATIONS,
      salt,
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  // Combine salt + hash for storage
  const hashBytes = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + hashBytes.length);
  combined.set(salt, 0);
  combined.set(hashBytes, salt.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    // Decode stored hash
    const combined = Uint8Array.from(atob(storedHash), (c) => c.charCodeAt(0));

    // Extract salt and hash
    const salt = combined.slice(0, 16);
    const storedHashBytes = combined.slice(16);

    // Re-derive with same salt
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: ITERATIONS,
        salt,
      },
      keyMaterial,
      HASH_LENGTH * 8
    );

    const derivedHash = new Uint8Array(derivedBits);

    // Constant-time comparison
    return timingSafeEqual(storedHashBytes, derivedHash);
  } catch {
    return false;
  }
}

// ============================================================
// JWT Token Management
// ============================================================

interface JwtPayload extends JWTPayload {
  sub: string;
  email?: string;
  sid?: string;
}

export async function generateJwt(
  payload: JwtPayload,
  secret: string,
  expiresInSeconds: number
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(key);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}

// ============================================================
// Session Token Utilities
// ============================================================

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
