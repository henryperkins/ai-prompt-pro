import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { createGitHubError } from "./github-errors.mjs";

function normalizeDatabaseUrl(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function textForError(error) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  if (!error || typeof error !== "object") return "";

  const candidate = error;
  const message = [
    typeof candidate.message === "string" ? candidate.message : "",
    typeof candidate.detail === "string" ? candidate.detail : "",
    typeof candidate.details === "string" ? candidate.details : "",
    typeof candidate.hint === "string" ? candidate.hint : "",
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  return message;
}

export function createNeonDatabaseClient({
  databaseUrl,
} = {}) {
  const connectionString = normalizeDatabaseUrl(databaseUrl);
  const sql = connectionString ? neon(connectionString) : null;

  function assertConfigured() {
    if (!connectionString || !sql) {
      throw createGitHubError(
        "GitHub backend storage is not configured.",
        "github_storage_unconfigured",
        503,
      );
    }
  }

  async function queryRows(queryText, params = []) {
    assertConfigured();

    try {
      const rows = await sql.query(queryText, params);
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      throw createGitHubError(
        textForError(error) || "Neon query failed.",
        "github_storage_error",
        500,
      );
    }
  }

  async function queryRow(queryText, params = []) {
    const rows = await queryRows(queryText, params);
    return rows[0] || null;
  }

  function hashStateNonce(nonce) {
    return createHash("sha256").update(String(nonce || "")).digest("hex");
  }

  return {
    hashStateNonce,
    queryRow,
    queryRows,
  };
}
