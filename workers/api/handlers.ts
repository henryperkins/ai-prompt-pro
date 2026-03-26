/**
 * API Handlers for Cloudflare Workers
 * Database operations for drafts, prompts, community, and profiles
 */

// ============================================================
// Inlined helpers (avoids importing frontend modules with Vite aliases)
// ============================================================

const VALID_CATEGORIES = new Set([
  "general", "frontend", "backend", "fullstack", "devops", "data",
  "ml-ai", "security", "testing", "api", "automation", "docs",
  "content", "analysis", "creative", "business", "education",
]);

function normalizePromptCategory(category?: string): string | undefined {
  if (category === undefined) return undefined;
  const normalized = category.trim().toLowerCase();
  if (!normalized) return "general";
  return VALID_CATEGORIES.has(normalized) ? normalized : "general";
}

async function computeFingerprint(configJson: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(configJson);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// ============================================================
// Type definitions
// ============================================================

export interface DraftRecord {
  id: string;
  user_id: string;
  config: string;
  updated_at: number;
}

export interface SavedPromptRecord {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  config: string;
  built_prompt: string;
  enhanced_prompt: string;
  fingerprint: string | null;
  revision: number;
  is_shared: number;
  target_model: string;
  use_case: string;
  remixed_from: string | null;
  remix_note: string;
  remix_diff: string | null;
  created_at: number;
  updated_at: number;
}

export interface CommunityPostRecord {
  id: string;
  saved_prompt_id: string;
  author_id: string;
  title: string;
  enhanced_prompt: string;
  description: string;
  use_case: string;
  category: string;
  tags: string;
  target_model: string;
  is_public: number;
  public_config: string;
  starter_prompt: string;
  remixed_from: string | null;
  remix_note: string;
  remix_diff: string | null;
  upvote_count: number;
  verified_count: number;
  remix_count: number;
  comment_count: number;
  created_at: number;
  updated_at: number;
}

export interface VoteRecord {
  id: string;
  post_id: string;
  user_id: string;
  vote_type: string;
  created_at: number;
}

export interface CommentRecord {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: number;
  updated_at: number;
}

export interface ProfileRecord {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: "upvote" | "verified" | "comment" | "remix";
  post_id: string | null;
  comment_id: string | null;
  read_at: number | null;
  created_at: number;
}

interface ContactMessageRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_country: string;
  phone_number: string;
  message: string;
  status: "new" | "reviewing" | "resolved";
  requester_user_id: string | null;
  created_at: number;
  updated_at: number;
}

const GITHUB_SHARE_BLOCKED_REASON = "Remove GitHub sources before sharing this prompt.";

export class PromptNotFoundError extends Error {
  constructor(message = "Prompt not found") {
    super(message);
    this.name = "PromptNotFoundError";
  }
}

export class PromptConflictError extends Error {
  constructor(message = "Prompt was modified elsewhere. Please refresh and try again.") {
    super(message);
    this.name = "PromptConflictError";
  }
}

type CommunityPostQueryRow = CommunityPostRecord & {
  rating_count?: number | null;
  rating_avg?: number | null;
};

const COMMUNITY_POST_SELECT_SQL = `
  SELECT
    cp.id,
    cp.saved_prompt_id,
    cp.author_id,
    cp.title,
    cp.enhanced_prompt,
    cp.description,
    cp.use_case,
    cp.category,
    cp.tags,
    cp.target_model,
    cp.is_public,
    cp.public_config,
    cp.starter_prompt,
    cp.remixed_from,
    cp.remix_note,
    cp.remix_diff,
    cp.upvote_count,
    cp.verified_count,
    cp.remix_count,
    cp.comment_count,
    cp.created_at,
    cp.updated_at,
    COALESCE(rating_stats.rating_count, 0) AS rating_count,
    COALESCE(rating_stats.rating_avg, 0) AS rating_avg
  FROM community_posts cp
  LEFT JOIN (
    SELECT
      post_id,
      COUNT(*) AS rating_count,
      ROUND(AVG(rating), 2) AS rating_avg
    FROM community_prompt_ratings
    GROUP BY post_id
  ) rating_stats
    ON rating_stats.post_id = cp.id
`;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function clampText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function clampRequiredText(value: unknown, label: string, maxLength: number): string {
  const normalized = clampText(value, maxLength);
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

function sqlPlaceholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}

function escapeSqlLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function buildPublicConfig(config: Record<string, unknown>): Record<string, unknown> {
  return {
    role: config.customRole || config.role || "",
    task: config.task || config.originalPrompt || "",
    format: Array.isArray(config.format) ? config.format : [],
    constraints: Array.isArray(config.constraints) ? config.constraints : [],
    tone: config.tone || "",
    complexity: config.complexity || "",
    examples: config.examples || "",
    lengthPreference: config.lengthPreference || "standard",
    contextConfig: {
      sources: [],
      databaseConnections: [],
      rag: {
        enabled: false,
        vectorStoreRef: "",
        namespace: "",
        topK: 5,
        minScore: 0.2,
        retrievalStrategy: "hybrid",
        documentRefs: [],
        chunkWindow: 3,
      },
      structured: {
        audience: "",
        product: "",
        offer: "",
        mustInclude: "",
        excludedTopics: "",
      },
      interviewAnswers: [],
      useDelimiters: true,
      projectNotes: "",
    },
  };
}

function hasGithubSourcesInConfig(config: Record<string, unknown>): boolean {
  const contextConfig = config.contextConfig;
  if (!contextConfig || typeof contextConfig !== "object") return false;

  const sources = (contextConfig as { sources?: unknown }).sources;
  if (!Array.isArray(sources)) return false;

  return sources.some((source) => {
    if (!source || typeof source !== "object") return false;
    const candidate = source as {
      type?: unknown;
      reference?: { kind?: unknown } | null;
    };
    return candidate.type === "github" || candidate.reference?.kind === "github";
  });
}

function mapSavedPromptRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    tags: parseJsonField<string[]>(row.tags, []),
    config: parseJsonField<Record<string, unknown>>(row.config, {}),
    remix_diff: parseJsonField<Record<string, unknown> | null>(row.remix_diff, null),
    is_shared: toBoolean(row.is_shared),
    community_post_id: typeof row.community_post_id === "string" ? row.community_post_id : null,
    upvote_count: toNumber(row.upvote_count),
    verified_count: toNumber(row.verified_count),
    remix_count: toNumber(row.remix_count),
    comment_count: toNumber(row.comment_count),
  };
}

function mapCommunityPostRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    tags: parseJsonField<string[]>(row.tags, []),
    public_config: parseJsonField<Record<string, unknown>>(row.public_config, {}),
    remix_diff: parseJsonField<Record<string, unknown> | null>(row.remix_diff, null),
    is_public: toBoolean(row.is_public),
    rating_count: toNumber(row.rating_count),
    rating_avg: toNumber(row.rating_avg),
  };
}

function mapCommentRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    created_at: toNumber(row.created_at),
    updated_at: toNumber(row.updated_at),
  };
}

function mapProfileRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    created_at: toNumber(row.created_at),
    updated_at: toNumber(row.updated_at),
  };
}

async function insertNotification(
  db: D1Database,
  input: {
    userId: string;
    actorId: string | null;
    type: NotificationRecord["type"];
    postId?: string | null;
    commentId?: string | null;
  },
): Promise<void> {
  if (!input.userId || (input.actorId && input.userId === input.actorId)) {
    return;
  }

  await db
    .prepare(
      `INSERT INTO notifications (
        id,
        user_id,
        actor_id,
        type,
        post_id,
        comment_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.userId,
      input.actorId,
      input.type,
      input.postId || null,
      input.commentId || null,
      nowSeconds(),
    )
    .run();
}

async function isSupportReviewerUser(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT user_id FROM support_reviewers WHERE user_id = ?")
    .bind(userId)
    .first();

  return Boolean((row as { user_id?: string } | null)?.user_id);
}

function getCommunitySortOrder(sort?: string): string {
  switch (sort) {
    case "popular":
      return "ORDER BY cp.upvote_count DESC, cp.created_at DESC";
    case "most_remixed":
      return "ORDER BY cp.remix_count DESC, cp.created_at DESC";
    case "verified":
      return "ORDER BY cp.verified_count DESC, cp.created_at DESC";
    default:
      return "ORDER BY cp.created_at DESC";
  }
}

async function loadCommunityPostRows(
  db: D1Database,
  options: {
    whereSql: string;
    values?: unknown[];
    orderBy?: string;
    limit?: number;
    offset?: number;
  },
): Promise<Record<string, unknown>[]> {
  let sql = `${COMMUNITY_POST_SELECT_SQL} WHERE ${options.whereSql}`;
  sql += ` ${options.orderBy || "ORDER BY cp.created_at DESC"}`;

  const values = [...(options.values || [])];
  if (typeof options.limit === "number") {
    sql += " LIMIT ?";
    values.push(options.limit);
  }
  if (typeof options.offset === "number") {
    sql += " OFFSET ?";
    values.push(options.offset);
  }

  const result = await db.prepare(sql).bind(...values).all();
  return (result.results || []).map((row: unknown) => mapCommunityPostRow(row as Record<string, unknown>));
}

async function decrementParentRemixCountIfNeeded(
  db: D1Database,
  remixedFrom: string | null | undefined,
): Promise<void> {
  if (!remixedFrom) return;

  await db
    .prepare("UPDATE community_posts SET remix_count = MAX(remix_count - 1, 0) WHERE id = ?")
    .bind(remixedFrom)
    .run();
}

// ============================================================
// Drafts
// ============================================================

export async function getDraftByUserId(
  db: D1Database,
  userId: string
): Promise<{ config: unknown } | null> {
  const result = await db
    .prepare("SELECT config FROM drafts WHERE user_id = ?")
    .bind(userId)
    .first();

  if (!result) return null;

  return {
    config: JSON.parse((result as { config: string }).config || "{}"),
  };
}

export async function saveDraftByUserId(
  db: D1Database,
  userId: string,
  config: unknown
): Promise<{ id: string; updated_at: number }> {
  const now = Math.floor(Date.now() / 1000);
  const configJson = JSON.stringify(config);

  // Try upsert
  const existing = await db
    .prepare("SELECT id FROM drafts WHERE user_id = ?")
    .bind(userId)
    .first();

  if (existing) {
    await db
      .prepare("UPDATE drafts SET config = ?, updated_at = ? WHERE user_id = ?")
      .bind(configJson, now, userId)
      .run();

    return { id: (existing as { id: string }).id, updated_at: now };
  } else {
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO drafts (id, user_id, config, updated_at) VALUES (?, ?, ?, ?)"
      )
      .bind(id, userId, configJson, now)
      .run();

    return { id, updated_at: now };
  }
}

export async function deleteDraftByUserId(
  db: D1Database,
  userId: string
): Promise<{ deleted: boolean }> {
  await db.prepare("DELETE FROM drafts WHERE user_id = ?").bind(userId).run();
  return { deleted: true };
}

// ============================================================
// Prompts
// ============================================================

export async function getPromptsByUserId(
  db: D1Database,
  userId: string
): Promise<unknown[]> {
  const result = await db
    .prepare(
      `SELECT
         sp.id,
         sp.user_id,
         sp.title,
         sp.description,
         sp.category,
         sp.tags,
         sp.config,
         sp.fingerprint,
         sp.revision,
         sp.is_shared,
         sp.target_model,
         sp.use_case,
         sp.remixed_from,
         sp.created_at,
         sp.updated_at,
         cp.id AS community_post_id,
         COALESCE(cp.upvote_count, 0) AS upvote_count,
         COALESCE(cp.verified_count, 0) AS verified_count,
         COALESCE(cp.remix_count, 0) AS remix_count,
         COALESCE(cp.comment_count, 0) AS comment_count
       FROM saved_prompts sp
       LEFT JOIN community_posts cp
         ON cp.saved_prompt_id = sp.id
        AND cp.is_public = 1
       WHERE sp.user_id = ?
       ORDER BY sp.updated_at DESC`
    )
    .bind(userId)
    .all();

  return (result.results || []).map((row: unknown) => mapSavedPromptRow(row as Record<string, unknown>));
}

export async function getPromptById(
  db: D1Database,
  promptId: string,
  userId: string
): Promise<unknown | null> {
  const result = await db
    .prepare(
      `SELECT
         sp.*,
         cp.id AS community_post_id,
         COALESCE(cp.upvote_count, 0) AS upvote_count,
         COALESCE(cp.verified_count, 0) AS verified_count,
         COALESCE(cp.remix_count, 0) AS remix_count,
         COALESCE(cp.comment_count, 0) AS comment_count
       FROM saved_prompts sp
       LEFT JOIN community_posts cp
         ON cp.saved_prompt_id = sp.id
        AND cp.is_public = 1
       WHERE sp.id = ? AND sp.user_id = ?`
    )
    .bind(promptId, userId)
    .first();

  if (!result) return null;

  return mapSavedPromptRow(result as Record<string, unknown>);
}

export async function createPrompt(
  db: D1Database,
  userId: string,
  input: {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
    config: unknown;
    built_prompt?: string;
    enhanced_prompt?: string;
    target_model?: string;
    use_case?: string;
    remixed_from?: string | null;
    remix_note?: string;
    remix_diff?: unknown;
    is_shared?: boolean;
  }
): Promise<{ id: string; revision: number }> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const configJson = JSON.stringify(input.config);
  const fingerprint = await computeFingerprint(configJson);
  const category = normalizePromptCategory(input.category) || "general";
  const tags = JSON.stringify(input.tags || []);

  await db
    .prepare(
      `INSERT INTO saved_prompts (
        id, user_id, title, description, category, tags, config,
        built_prompt, enhanced_prompt, fingerprint, revision,
        is_shared, target_model, use_case, remixed_from,
        remix_note, remix_diff, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      input.title.trim().slice(0, 200) || "Untitled Prompt",
      (input.description || "").trim().slice(0, 500),
      category,
      tags,
      configJson,
      (input.built_prompt || "").trim(),
      (input.enhanced_prompt || "").trim(),
      fingerprint,
      1,
      input.is_shared ? 1 : 0,
      (input.target_model || "").trim().slice(0, 80),
      (input.use_case || "").trim().slice(0, 500),
      input.remixed_from || null,
      (input.remix_note || "").trim().slice(0, 500),
      input.remix_diff ? JSON.stringify(input.remix_diff) : null,
      now,
      now
    )
    .run();

  return { id, revision: 1 };
}

export async function updatePrompt(
  db: D1Database,
  promptId: string,
  userId: string,
  input: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    config?: unknown;
    built_prompt?: string;
    enhanced_prompt?: string;
    target_model?: string;
    use_case?: string;
    is_shared?: boolean;
    remixed_from?: string | null;
    remix_note?: string;
    remix_diff?: unknown;
    expected_revision?: number;
  }
): Promise<{ revision: number }> {
  const now = Math.floor(Date.now() / 1000);
  const existing = await db
    .prepare("SELECT revision FROM saved_prompts WHERE id = ? AND user_id = ?")
    .bind(promptId, userId)
    .first();

  if (!existing) {
    throw new PromptNotFoundError();
  }

  const currentRevision = toNumber((existing as { revision?: unknown }).revision, 1);
  const expectedRevision = typeof input.expected_revision === "number"
    ? input.expected_revision
    : currentRevision;

  if (typeof input.expected_revision === "number" && input.expected_revision !== currentRevision) {
    throw new PromptConflictError();
  }

  const newRevision = expectedRevision + 1;
  const configJson = input.config ? JSON.stringify(input.config) : null;
  const fingerprint = configJson ? await computeFingerprint(configJson) : null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title.trim().slice(0, 200) || "Untitled Prompt");
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description.trim().slice(0, 500));
  }
  if (input.category !== undefined) {
    fields.push("category = ?");
    values.push(normalizePromptCategory(input.category) || "general");
  }
  if (input.tags !== undefined) {
    fields.push("tags = ?");
    values.push(JSON.stringify(input.tags));
  }
  if (configJson) {
    fields.push("config = ?", "fingerprint = ?");
    values.push(configJson, fingerprint);
  }
  if (input.built_prompt !== undefined) {
    fields.push("built_prompt = ?");
    values.push(input.built_prompt.trim());
  }
  if (input.enhanced_prompt !== undefined) {
    fields.push("enhanced_prompt = ?");
    values.push(input.enhanced_prompt.trim());
  }
  if (input.target_model !== undefined) {
    fields.push("target_model = ?");
    values.push(input.target_model.trim().slice(0, 80));
  }
  if (input.use_case !== undefined) {
    fields.push("use_case = ?");
    values.push(input.use_case.trim().slice(0, 500));
  }
  if (input.is_shared !== undefined) {
    fields.push("is_shared = ?");
    values.push(input.is_shared ? 1 : 0);
  }
  if (input.remixed_from !== undefined) {
    fields.push("remixed_from = ?");
    values.push(input.remixed_from);
  }
  if (input.remix_note !== undefined) {
    fields.push("remix_note = ?");
    values.push(input.remix_note.trim().slice(0, 500));
  }
  if (input.remix_diff !== undefined) {
    fields.push("remix_diff = ?");
    values.push(JSON.stringify(input.remix_diff));
  }

  fields.push("revision = ?", "updated_at = ?");
  values.push(newRevision, now);

  const sql = `UPDATE saved_prompts SET ${fields.join(", ")} WHERE id = ? AND user_id = ? AND revision = ?`;
  const result = await db.prepare(sql).bind(...values, promptId, userId, expectedRevision).run();

  if ((result.meta?.changes || 0) === 0) {
    throw new PromptConflictError();
  }

  return { revision: newRevision };
}

export async function deletePrompt(
  db: D1Database,
  promptId: string,
  userId: string
): Promise<{ deleted: boolean }> {
  const sharedPost = await db
    .prepare(
      `SELECT id, remixed_from
       FROM community_posts
       WHERE saved_prompt_id = ? AND author_id = ? AND is_public = 1`
    )
    .bind(promptId, userId)
    .first();

  if (sharedPost && typeof (sharedPost as { remixed_from?: unknown }).remixed_from === "string") {
    await db
      .prepare(
        "UPDATE community_posts SET remix_count = MAX(remix_count - 1, 0) WHERE id = ?"
      )
      .bind((sharedPost as { remixed_from: string }).remixed_from)
      .run();
  }

  await db
    .prepare("DELETE FROM saved_prompts WHERE id = ? AND user_id = ?")
    .bind(promptId, userId)
    .run();

  return { deleted: true };
}

export async function sharePrompt(
  db: D1Database,
  promptId: string,
  userId: string,
  input: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    target_model?: string;
    use_case?: string;
  }
): Promise<{ shared: boolean; postId?: string }> {
  const now = nowSeconds();

  // Get prompt data
  const prompt = await db
    .prepare("SELECT * FROM saved_prompts WHERE id = ? AND user_id = ?")
    .bind(promptId, userId)
    .first();

  if (!prompt) {
    throw new PromptNotFoundError();
  }

  const p = prompt as SavedPromptRecord;
  const config = parseJsonField<Record<string, unknown>>(p.config, {});
  if (hasGithubSourcesInConfig(config)) {
    throw new Error(GITHUB_SHARE_BLOCKED_REASON);
  }

  const effectiveUseCase = clampText(input.use_case ?? p.use_case ?? "", 500);
  if (!effectiveUseCase) {
    throw new Error("Use case is required before sharing.");
  }

  const publicConfig = buildPublicConfig(config);
  const starterPrompt = effectiveUseCase;
  const existingPost = await db
    .prepare(
      `SELECT id, is_public, created_at, remixed_from
       FROM community_posts
       WHERE saved_prompt_id = ? AND author_id = ?`
    )
    .bind(promptId, userId)
    .first();
  const postId = typeof (existingPost as { id?: unknown } | null)?.id === "string"
    ? (existingPost as { id: string }).id
    : crypto.randomUUID();
  const wasPublic = toBoolean((existingPost as { is_public?: unknown } | null)?.is_public);
  const remixedFrom = p.remixed_from || null;

  if (existingPost) {
    await db
      .prepare(
        `UPDATE community_posts
         SET title = ?,
             enhanced_prompt = ?,
             description = ?,
             use_case = ?,
             category = ?,
             tags = ?,
             target_model = ?,
             is_public = 1,
             public_config = ?,
             starter_prompt = ?,
             remixed_from = ?,
             remix_note = ?,
             remix_diff = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        input.title || p.title,
        p.enhanced_prompt,
        input.description || p.description || "",
        effectiveUseCase,
        input.category || p.category || "general",
        input.tags ? JSON.stringify(input.tags) : p.tags,
        input.target_model || p.target_model || "",
        JSON.stringify(publicConfig),
        starterPrompt,
        remixedFrom,
        p.remix_note,
        p.remix_diff,
        now,
        postId,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO community_posts (
          id, saved_prompt_id, author_id, title, enhanced_prompt, description,
          use_case, category, tags, target_model, is_public, public_config,
          starter_prompt, remixed_from, remix_note, remix_diff,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        postId,
        promptId,
        userId,
        input.title || p.title,
        p.enhanced_prompt,
        input.description || p.description || "",
        effectiveUseCase,
        input.category || p.category || "general",
        input.tags ? JSON.stringify(input.tags) : p.tags,
        input.target_model || p.target_model || "",
        1,
        JSON.stringify(publicConfig),
        starterPrompt,
        remixedFrom,
        p.remix_note,
        p.remix_diff,
        now,
        now,
      )
      .run();
  }

  // Update saved_prompts is_shared
  await db
    .prepare("UPDATE saved_prompts SET is_shared = 1, use_case = ? WHERE id = ? AND user_id = ?")
    .bind(effectiveUseCase, promptId, userId)
    .run();

  if (!wasPublic && remixedFrom) {
    await db
      .prepare(
        "UPDATE community_posts SET remix_count = remix_count + 1 WHERE id = ?"
      )
      .bind(remixedFrom)
      .run();

    const parentPost = await db
      .prepare("SELECT author_id FROM community_posts WHERE id = ?")
      .bind(remixedFrom)
      .first();

    if (typeof (parentPost as { author_id?: unknown } | null)?.author_id === "string") {
      await insertNotification(db, {
        userId: (parentPost as { author_id: string }).author_id,
        actorId: userId,
        type: "remix",
        postId: remixedFrom,
      });
    }
  }

  return { shared: true, postId };
}

export async function unsharePrompt(
  db: D1Database,
  promptId: string,
  userId: string
): Promise<{ unshared: boolean }> {
  const existingPost = await db
    .prepare(
      `SELECT id, remixed_from
       FROM community_posts
       WHERE saved_prompt_id = ? AND author_id = ? AND is_public = 1`
    )
    .bind(promptId, userId)
    .first();

  if (existingPost && typeof (existingPost as { remixed_from?: unknown }).remixed_from === "string") {
    await db
      .prepare(
        "UPDATE community_posts SET remix_count = MAX(remix_count - 1, 0) WHERE id = ?"
      )
      .bind((existingPost as { remixed_from: string }).remixed_from)
      .run();
  }

  await db
    .prepare("UPDATE community_posts SET is_public = 0, updated_at = ? WHERE saved_prompt_id = ? AND author_id = ?")
    .bind(nowSeconds(), promptId, userId)
    .run();

  await db
    .prepare("UPDATE saved_prompts SET is_shared = 0 WHERE id = ? AND user_id = ?")
    .bind(promptId, userId)
    .run();

  return { unshared: true };
}

// ============================================================
// Community
// ============================================================

export async function getCommunityPosts(
  db: D1Database,
  filters: {
    category?: string | null;
    tag?: string | null;
    sort?: string;
    search?: string | null;
    cursor?: string | null;
    page?: number;
  },
  limit: number
): Promise<{ posts: unknown[]; next_cursor: string | null }> {
  const normalizedLimit = Math.max(1, Math.min(limit, 100));
  const normalizedPage = Math.max(0, Math.floor(filters.page || 0));
  let whereSql = "cp.is_public = 1";
  const values: unknown[] = [];

  if (filters.category && filters.category !== "all") {
    whereSql += " AND cp.category = ?";
    values.push(filters.category);
  }

  if (filters.tag) {
    whereSql += " AND cp.tags LIKE ?";
    values.push(`%"${filters.tag}"%`);
  }

  if (filters.cursor) {
    whereSql += " AND cp.created_at < ?";
    values.push(Math.floor(new Date(filters.cursor).getTime() / 1000));
  }

  const normalizedSearch = clampText(filters.search, 200).toLowerCase();
  if (normalizedSearch) {
    const likeValue = `%${escapeSqlLike(normalizedSearch)}%`;
    whereSql += " AND (LOWER(cp.title) LIKE ? ESCAPE '\\' OR LOWER(cp.use_case) LIKE ? ESCAPE '\\')";
    values.push(likeValue, likeValue);
  }

  const rows = await loadCommunityPostRows(db, {
    whereSql,
    values,
    orderBy: getCommunitySortOrder(filters.sort),
    limit: normalizedLimit + 1,
    offset: filters.cursor ? undefined : normalizedPage * normalizedLimit,
  });

  const hasMore = rows.length > normalizedLimit;
  const posts = hasMore ? rows.slice(0, normalizedLimit) : rows;

  const nextCursor = hasMore && posts.length > 0
    ? new Date((posts[posts.length - 1] as { created_at: number }).created_at * 1000).toISOString()
    : null;

  return { posts, next_cursor: nextCursor };
}

export async function getCommunityPostById(
  db: D1Database,
  postId: string
): Promise<unknown | null> {
  const rows = await loadCommunityPostRows(db, {
    whereSql: "cp.id = ? AND cp.is_public = 1",
    values: [postId],
    limit: 1,
  });

  return rows[0] ?? null;
}

export async function getCommunityPostsByIds(
  db: D1Database,
  postIds: string[]
): Promise<unknown[]> {
  const uniqueIds = uniqueStrings(postIds);
  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await loadCommunityPostRows(db, {
    whereSql: `cp.is_public = 1 AND cp.id IN (${sqlPlaceholders(uniqueIds.length)})`,
    values: uniqueIds,
  });

  const rowById = new Map(rows.map((row) => [String(row.id), row]));
  return uniqueIds.map((id) => rowById.get(id)).filter(Boolean) as Record<string, unknown>[];
}

export async function getPostsByAuthor(
  db: D1Database,
  authorId: string,
  options: { page?: number; limit?: number } = {}
): Promise<unknown[]> {
  const normalizedLimit = Math.max(1, Math.min(options.limit || 25, 100));
  const normalizedPage = Math.max(0, Math.floor(options.page || 0));

  return loadCommunityPostRows(db, {
    whereSql: "cp.author_id = ? AND cp.is_public = 1",
    values: [authorId],
    orderBy: "ORDER BY cp.created_at DESC",
    limit: normalizedLimit,
    offset: normalizedPage * normalizedLimit,
  });
}

export async function getPersonalFeed(
  db: D1Database,
  userId: string,
  options: { page?: number; limit?: number } = {}
): Promise<unknown[]> {
  const followingRows = await db
    .prepare(
      `SELECT followed_user_id
       FROM community_user_follows
       WHERE follower_id = ?`
    )
    .bind(userId)
    .all();

  const authorIds = uniqueStrings([
    userId,
    ...(followingRows.results || []).map((row) => (row as { followed_user_id?: string }).followed_user_id || null),
  ]);

  if (authorIds.length === 0) {
    return [];
  }

  const normalizedLimit = Math.max(1, Math.min(options.limit || 25, 100));
  const normalizedPage = Math.max(0, Math.floor(options.page || 0));

  return loadCommunityPostRows(db, {
    whereSql: `cp.is_public = 1 AND cp.author_id IN (${sqlPlaceholders(authorIds.length)})`,
    values: authorIds,
    orderBy: "ORDER BY cp.created_at DESC",
    limit: normalizedLimit,
    offset: normalizedPage * normalizedLimit,
  });
}

export async function getRemixesByPostId(
  db: D1Database,
  postId: string
): Promise<unknown[]> {
  return loadCommunityPostRows(db, {
    whereSql: "cp.remixed_from = ? AND cp.is_public = 1",
    values: [postId],
    orderBy: "ORDER BY cp.created_at DESC",
  });
}

export async function createVote(
  db: D1Database,
  postId: string,
  userId: string,
  voteType: "upvote" | "verified"
): Promise<{ active: boolean; row_id: string | null }> {
  const existing = await db
    .prepare("SELECT id FROM community_votes WHERE post_id = ? AND user_id = ? AND vote_type = ?")
    .bind(postId, userId, voteType)
    .first();

  if (existing) {
    return { active: true, row_id: (existing as { id: string }).id };
  }

  const id = crypto.randomUUID();
  const now = nowSeconds();

  await db
    .prepare(
      "INSERT INTO community_votes (id, post_id, user_id, vote_type, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, postId, userId, voteType, now)
    .run();

  const column = voteType === "upvote" ? "upvote_count" : "verified_count";
  await db
    .prepare(`UPDATE community_posts SET ${column} = ${column} + 1 WHERE id = ?`)
    .bind(postId)
    .run();

  const post = await db
    .prepare("SELECT author_id FROM community_posts WHERE id = ?")
    .bind(postId)
    .first();

  if (typeof (post as { author_id?: unknown } | null)?.author_id === "string") {
    await insertNotification(db, {
      userId: (post as { author_id: string }).author_id,
      actorId: userId,
      type: voteType,
      postId,
    });
  }

  return { active: true, row_id: id };
}

export async function deleteVote(
  db: D1Database,
  postId: string,
  userId: string,
  voteType: "upvote" | "verified"
): Promise<{ active: boolean; row_id: null }> {
  const vote = await db
    .prepare("SELECT vote_type FROM community_votes WHERE post_id = ? AND user_id = ? AND vote_type = ?")
    .bind(postId, userId, voteType)
    .first();

  if (vote) {
    const column = (vote as { vote_type: string }).vote_type === "upvote" ? "upvote_count" : "verified_count";
    await db
      .prepare(`UPDATE community_posts SET ${column} = MAX(${column} - 1, 0) WHERE id = ?`)
      .bind(postId)
      .run();
  }

  await db
    .prepare("DELETE FROM community_votes WHERE post_id = ? AND user_id = ? AND vote_type = ?")
    .bind(postId, userId, voteType)
    .run();

  return { active: false, row_id: null };
}

export async function createComment(
  db: D1Database,
  postId: string,
  userId: string,
  body: string
): Promise<unknown> {
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const normalizedBody = clampRequiredText(body, "Comment", 2000);

  await db
    .prepare(
      "INSERT INTO community_comments (id, post_id, user_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id, postId, userId, normalizedBody, now, now)
    .run();

  await db
    .prepare("UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?")
    .bind(postId)
    .run();

  const post = await db
    .prepare("SELECT author_id FROM community_posts WHERE id = ?")
    .bind(postId)
    .first();

  if (typeof (post as { author_id?: unknown } | null)?.author_id === "string") {
    await insertNotification(db, {
      userId: (post as { author_id: string }).author_id,
      actorId: userId,
      type: "comment",
      postId,
      commentId: id,
    });
  }

  return mapCommentRow({
    id,
    post_id: postId,
    user_id: userId,
    body: normalizedBody,
    created_at: now,
    updated_at: now,
  });
}

export async function updateComment(
  db: D1Database,
  commentId: string,
  userId: string,
  body: string
): Promise<{ updated: boolean }> {
  const now = nowSeconds();

  await db
    .prepare("UPDATE community_comments SET body = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(clampRequiredText(body, "Comment", 2000), now, commentId, userId)
    .run();

  return { updated: true };
}

export async function deleteComment(
  db: D1Database,
  commentId: string,
  userId: string
): Promise<{ deleted: boolean }> {
  const comment = await db
    .prepare("SELECT post_id FROM community_comments WHERE id = ? AND user_id = ?")
    .bind(commentId, userId)
    .first();

  if (comment) {
    await db
      .prepare("UPDATE community_posts SET comment_count = MAX(comment_count - 1, 0) WHERE id = ?")
      .bind((comment as { post_id: string }).post_id)
      .run();
  }

  await db
    .prepare("DELETE FROM community_comments WHERE id = ? AND user_id = ?")
    .bind(commentId, userId)
    .run();

  return { deleted: true };
}

export async function getCommentsByPostId(
  db: D1Database,
  postId: string,
  options: { limit?: number; cursor?: string | null } = {}
): Promise<unknown[]> {
  const normalizedLimit = Math.max(1, Math.min(options.limit || 25, 200));
  let sql = `
    SELECT id, post_id, user_id, body, created_at, updated_at
    FROM community_comments
    WHERE post_id = ?
  `;
  const values: unknown[] = [postId];

  if (options.cursor) {
    sql += " AND created_at < ?";
    values.push(Math.floor(new Date(options.cursor).getTime() / 1000));
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  values.push(normalizedLimit);

  const result = await db.prepare(sql).bind(...values).all();
  return (result.results || []).map((row: unknown) => mapCommentRow(row as Record<string, unknown>));
}

export async function getVoteStates(
  db: D1Database,
  userId: string,
  postIds: string[]
): Promise<unknown[]> {
  const uniqueIds = uniqueStrings(postIds);
  if (uniqueIds.length === 0) {
    return [];
  }

  const result = await db
    .prepare(
      `SELECT post_id, vote_type
       FROM community_votes
       WHERE user_id = ?
         AND post_id IN (${sqlPlaceholders(uniqueIds.length)})`
    )
    .bind(userId, ...uniqueIds)
    .all();

  return result.results || [];
}

export async function getRatingStates(
  db: D1Database,
  userId: string,
  postIds: string[]
): Promise<unknown[]> {
  const uniqueIds = uniqueStrings(postIds);
  if (uniqueIds.length === 0) {
    return [];
  }

  const result = await db
    .prepare(
      `SELECT post_id, rating
       FROM community_prompt_ratings
       WHERE user_id = ?
         AND post_id IN (${sqlPlaceholders(uniqueIds.length)})`
    )
    .bind(userId, ...uniqueIds)
    .all();

  return result.results || [];
}

export async function setPromptRating(
  db: D1Database,
  postId: string,
  userId: string,
  rating: number | null
): Promise<{ rating: number | null }> {
  if (rating === null) {
    await db
      .prepare("DELETE FROM community_prompt_ratings WHERE post_id = ? AND user_id = ?")
      .bind(postId, userId)
      .run();
    return { rating: null };
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO community_prompt_ratings (
        id,
        post_id,
        user_id,
        rating,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(post_id, user_id)
      DO UPDATE SET
        rating = excluded.rating,
        updated_at = excluded.updated_at`
    )
    .bind(crypto.randomUUID(), postId, userId, rating, now, now)
    .run();

  return { rating };
}

// ============================================================
// Profiles
// ============================================================

export async function getProfileByUserId(
  db: D1Database,
  userId: string
): Promise<unknown | null> {
  const result = await db
    .prepare("SELECT id, display_name, avatar_url, created_at, updated_at FROM profiles WHERE id = ?")
    .bind(userId)
    .first();

  return result ? mapProfileRow(result as Record<string, unknown>) : null;
}

export async function updateProfile(
  db: D1Database,
  userId: string,
  input: {
    display_name?: string;
    avatar_url?: string;
  }
): Promise<{ updated: boolean }> {
  const now = nowSeconds();
  const profileFields: string[] = [];
  const profileValues: unknown[] = [];
  const userFields: string[] = [];
  const userValues: unknown[] = [];

  if (input.display_name !== undefined) {
    const displayName = input.display_name.trim().slice(0, 100);
    profileFields.push("display_name = ?");
    profileValues.push(displayName);
    userFields.push("display_name = ?");
    userValues.push(displayName);
  }
  if (input.avatar_url !== undefined) {
    profileFields.push("avatar_url = ?");
    profileValues.push(input.avatar_url);
    userFields.push("avatar_url = ?");
    userValues.push(input.avatar_url);
  }

  if (profileFields.length === 0) {
    return { updated: false };
  }

  profileFields.push("updated_at = ?");
  profileValues.push(now);
  userFields.push("updated_at = ?");
  userValues.push(now);

  const profileSql = `UPDATE profiles SET ${profileFields.join(", ")} WHERE id = ?`;
  await db.prepare(profileSql).bind(...profileValues, userId).run();

  const userSql = `UPDATE users SET ${userFields.join(", ")} WHERE id = ?`;
  await db.prepare(userSql).bind(...userValues, userId).run();

  return { updated: true };
}

export async function getProfilesByUserIds(
  db: D1Database,
  userIds: string[]
): Promise<unknown[]> {
  const uniqueIds = uniqueStrings(userIds);
  if (uniqueIds.length === 0) {
    return [];
  }

  const result = await db
    .prepare(
      `SELECT id, display_name, avatar_url, created_at, updated_at
       FROM profiles
       WHERE id IN (${sqlPlaceholders(uniqueIds.length)})`
    )
    .bind(...uniqueIds)
    .all();

  const rows = (result.results || []).map((row: unknown) => mapProfileRow(row as Record<string, unknown>));
  const rowById = new Map(rows.map((row) => [String(row.id), row]));
  return uniqueIds.map((id) => rowById.get(id)).filter(Boolean) as Record<string, unknown>[];
}

export async function getFollowStats(
  db: D1Database,
  userId: string
): Promise<{ followers_count: number; following_count: number }> {
  const [followersResult, followingResult] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM community_user_follows
         WHERE followed_user_id = ?`
      )
      .bind(userId)
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM community_user_follows
         WHERE follower_id = ?`
      )
      .bind(userId)
      .first(),
  ]);

  return {
    followers_count: toNumber((followersResult as { count?: unknown } | null)?.count),
    following_count: toNumber((followingResult as { count?: unknown } | null)?.count),
  };
}

export async function getProfileActivityStats(
  db: D1Database,
  userId: string
): Promise<{ total_posts: number; total_upvotes: number; total_verified: number; average_rating: number }> {
  const postsResult = await db
    .prepare(
      `SELECT
         COUNT(*) AS total_posts,
         COALESCE(SUM(upvote_count), 0) AS total_upvotes,
         COALESCE(SUM(verified_count), 0) AS total_verified
       FROM community_posts
       WHERE author_id = ? AND is_public = 1`
    )
    .bind(userId)
    .first();

  const ratingResult = await db
    .prepare(
      `SELECT ROUND(AVG(cpr.rating), 2) AS average_rating
       FROM community_prompt_ratings cpr
       INNER JOIN community_posts cp
         ON cp.id = cpr.post_id
       WHERE cp.author_id = ?
         AND cp.is_public = 1`
    )
    .bind(userId)
    .first();

  return {
    total_posts: toNumber((postsResult as { total_posts?: unknown } | null)?.total_posts),
    total_upvotes: toNumber((postsResult as { total_upvotes?: unknown } | null)?.total_upvotes),
    total_verified: toNumber((postsResult as { total_verified?: unknown } | null)?.total_verified),
    average_rating: toNumber((ratingResult as { average_rating?: unknown } | null)?.average_rating),
  };
}

export async function getFollowingUserIds(
  db: D1Database,
  userId: string
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT followed_user_id
       FROM community_user_follows
       WHERE follower_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all();

  return (result.results || [])
    .map((row) => (row as { followed_user_id?: string }).followed_user_id || null)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export async function isFollowingUser(
  db: D1Database,
  userId: string,
  targetUserId: string
): Promise<{ following: boolean }> {
  if (!targetUserId || userId === targetUserId) {
    return { following: false };
  }

  const result = await db
    .prepare(
      `SELECT id
       FROM community_user_follows
       WHERE follower_id = ? AND followed_user_id = ?`
    )
    .bind(userId, targetUserId)
    .first();

  return { following: Boolean((result as { id?: string } | null)?.id) };
}

export async function followUser(
  db: D1Database,
  userId: string,
  targetUserId: string
): Promise<{ following: boolean }> {
  if (!targetUserId || userId === targetUserId) {
    throw new Error("You cannot follow your own account.");
  }

  await db
    .prepare(
      `INSERT INTO community_user_follows (
        id,
        follower_id,
        followed_user_id,
        created_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(follower_id, followed_user_id) DO NOTHING`
    )
    .bind(crypto.randomUUID(), userId, targetUserId, nowSeconds())
    .run();

  return { following: true };
}

export async function unfollowUser(
  db: D1Database,
  userId: string,
  targetUserId: string
): Promise<{ following: boolean }> {
  await db
    .prepare(
      `DELETE FROM community_user_follows
       WHERE follower_id = ? AND followed_user_id = ?`
    )
    .bind(userId, targetUserId)
    .run();

  return { following: false };
}

export async function getBlockedUserIds(
  db: D1Database,
  userId: string
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT blocked_user_id
       FROM community_user_blocks
       WHERE blocker_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all();

  return (result.results || [])
    .map((row) => (row as { blocked_user_id?: string }).blocked_user_id || null)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export async function blockUser(
  db: D1Database,
  userId: string,
  blockedUserId: string,
  reason?: string
): Promise<{ blocked: boolean }> {
  if (!blockedUserId || blockedUserId === userId) {
    throw new Error("You cannot block your own account.");
  }

  await db
    .prepare(
      `INSERT INTO community_user_blocks (
        id,
        blocker_id,
        blocked_user_id,
        reason,
        created_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(blocker_id, blocked_user_id)
      DO UPDATE SET reason = excluded.reason`
    )
    .bind(crypto.randomUUID(), userId, blockedUserId, clampText(reason, 500), nowSeconds())
    .run();

  return { blocked: true };
}

export async function unblockUser(
  db: D1Database,
  userId: string,
  blockedUserId: string
): Promise<{ blocked: false }> {
  await db
    .prepare(
      `DELETE FROM community_user_blocks
       WHERE blocker_id = ? AND blocked_user_id = ?`
    )
    .bind(userId, blockedUserId)
    .run();

  return { blocked: false };
}

export async function createCommunityReport(
  db: D1Database,
  userId: string,
  input: {
    target_type: "post" | "comment";
    post_id?: string | null;
    comment_id?: string | null;
    reported_user_id?: string | null;
    reason?: string;
    details?: string;
  }
): Promise<{ id: string }> {
  if (input.target_type === "post" && !input.post_id) {
    throw new Error("Post report is missing a post id.");
  }
  if (input.target_type === "comment" && !input.comment_id) {
    throw new Error("Comment report is missing a comment id.");
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO community_reports (
        id,
        reporter_id,
        reported_user_id,
        target_type,
        reason,
        details,
        post_id,
        comment_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      input.reported_user_id || null,
      input.target_type,
      clampRequiredText(input.reason || "other", "Reason", 80),
      clampText(input.details, 2000),
      input.post_id || null,
      input.comment_id || null,
      nowSeconds(),
    )
    .run();

  return { id };
}

export async function getNotifications(
  db: D1Database,
  userId: string,
  limit: number,
  offset: number
): Promise<unknown[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 100));
  const normalizedOffset = Math.max(0, offset);
  const result = await db
    .prepare(
      `SELECT
         n.id,
         n.user_id,
         n.actor_id,
         n.type,
         n.post_id,
         n.comment_id,
         n.read_at,
         n.created_at,
         COALESCE(p.display_name, 'Community member') AS actor_display_name,
         p.avatar_url AS actor_avatar_url,
         COALESCE(cp.title, 'your post') AS post_title
       FROM notifications n
       LEFT JOIN profiles p
         ON p.id = n.actor_id
       LEFT JOIN community_posts cp
         ON cp.id = n.post_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(userId, normalizedLimit, normalizedOffset)
    .all();

  return result.results || [];
}

export async function getUnreadNotificationCount(
  db: D1Database,
  userId: string
): Promise<{ count: number }> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = ? AND read_at IS NULL`
    )
    .bind(userId)
    .first();

  return { count: toNumber((result as { count?: unknown } | null)?.count) };
}

export async function markNotificationRead(
  db: D1Database,
  userId: string,
  notificationId: string
): Promise<{ changed: boolean }> {
  const now = nowSeconds();
  const unread = await db
    .prepare(
      `SELECT id
       FROM notifications
       WHERE id = ? AND user_id = ? AND read_at IS NULL`
    )
    .bind(notificationId, userId)
    .first();

  if (!unread) {
    return { changed: false };
  }

  await db
    .prepare(
      `UPDATE notifications
       SET read_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(now, notificationId, userId)
    .run();

  return { changed: true };
}

export async function markAllNotificationsRead(
  db: D1Database,
  userId: string
): Promise<{ changed: number }> {
  const unread = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = ? AND read_at IS NULL`
    )
    .bind(userId)
    .first();
  const changed = toNumber((unread as { count?: unknown } | null)?.count);

  if (changed === 0) {
    return { changed: 0 };
  }

  await db
    .prepare(
      `UPDATE notifications
       SET read_at = ?
       WHERE user_id = ? AND read_at IS NULL`
    )
    .bind(nowSeconds(), userId)
    .run();

  return { changed };
}

export async function getSupportReviewerAccess(
  db: D1Database,
  userId: string
): Promise<{ allowed: boolean }> {
  return { allowed: await isSupportReviewerUser(db, userId) };
}

export async function createContactMessage(
  db: D1Database,
  input: {
    first_name: string;
    last_name: string;
    email: string;
    phone_country?: string;
    phone_number?: string;
    message: string;
    requester_user_id?: string | null;
    privacy_consent: boolean;
  }
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO contact_messages (
        id,
        first_name,
        last_name,
        email,
        phone_country,
        phone_number,
        message,
        requester_user_id,
        privacy_consent,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      clampRequiredText(input.first_name, "First name", 80),
      clampRequiredText(input.last_name, "Last name", 80),
      clampRequiredText(input.email, "Email", 320).toLowerCase(),
      clampText(input.phone_country || "US", 8).toUpperCase() || "US",
      clampText(input.phone_number, 50),
      clampRequiredText(input.message, "Message", 5000),
      input.requester_user_id || null,
      input.privacy_consent ? 1 : 0,
      now,
      now,
    )
    .run();

  return { id };
}

export async function listContactMessages(
  db: D1Database,
  limit: number
): Promise<unknown[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 500));
  const result = await db
    .prepare(
      `SELECT
         id,
         first_name,
         last_name,
         email,
         phone_country,
         phone_number,
         message,
         status,
         requester_user_id,
         created_at,
         updated_at
       FROM contact_messages
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(normalizedLimit)
    .all();

  return (result.results || []).map((row: unknown) => row as ContactMessageRecord);
}

export async function updateContactMessageStatus(
  db: D1Database,
  messageId: string,
  status: "new" | "reviewing" | "resolved"
): Promise<{ updated: boolean }> {
  if (status !== "new" && status !== "reviewing" && status !== "resolved") {
    throw new Error("Invalid support message status.");
  }

  await db
    .prepare(
      `UPDATE contact_messages
       SET status = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(status, nowSeconds(), messageId)
    .run();

  return { updated: true };
}
