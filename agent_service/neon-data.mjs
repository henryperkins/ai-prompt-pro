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
  debug = false,
} = {}) {
  const connectionString = normalizeDatabaseUrl(databaseUrl);
  const sql = connectionString ? neon(connectionString) : null;

  function buildQueryPreviewLogField(queryText) {
    if (!debug) {
      return {};
    }

    return {
      query_preview: queryText.trim().substring(0, 80),
    };
  }

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
      // --- Diagnostic: log unexpected return shape ---
      if (!Array.isArray(rows)) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          event: "neon_query_unexpected_return",
          message: "sql.query() did not return an array. Possible RLS policy or role issue.",
          return_type: typeof rows,
          is_null: rows === null,
          has_rows_property: rows && typeof rows === "object" ? "rows" in rows : false,
          ...buildQueryPreviewLogField(queryText),
        }));
      }
      // --- End diagnostic ---
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      // --- Diagnostic: log original DB error before rethrowing ---
      const isRlsLikely =
        typeof error?.message === "string" &&
        (error.message.includes("permission denied") ||
         error.message.includes("row-level security") ||
         error.message.includes("new row violates") ||
         error.message.includes("policy"));
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "neon_query_error",
        message: textForError(error) || "Unknown Neon query error",
        is_rls_likely: isRlsLikely,
        error_code: error?.code || null,
        ...buildQueryPreviewLogField(queryText),
      }));
      // --- End diagnostic ---
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
