/**
 * PromptForge API Worker
 * RESTful API for drafts, prompts, community, and profiles
 */

import { Hono, type Context } from "hono";
import { verifyToken } from "../lib/auth";
import {
  getDraftByUserId,
  saveDraftByUserId,
  deleteDraftByUserId,
  getPromptsByUserId,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  sharePrompt,
  unsharePrompt,
  getCommunityPosts,
  getCommunityPostsByIds,
  getCommunityPostById,
  getPostsByAuthor,
  getPersonalFeed,
  getRemixesByPostId,
  createVote,
  deleteVote,
  getVoteStates,
  getRatingStates,
  setPromptRating,
  createComment,
  updateComment,
  deleteComment,
  getCommentsByPostId,
  getProfileByUserId,
  getProfilesByUserIds,
  getFollowStats,
  getProfileActivityStats,
  getFollowingUserIds,
  isFollowingUser,
  followUser,
  unfollowUser,
  updateProfile,
  getBlockedUserIds,
  blockUser,
  unblockUser,
  createCommunityReport,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getSupportReviewerAccess,
  createContactMessage,
  listContactMessages,
  updateContactMessageStatus,
  PromptConflictError,
  PromptNotFoundError,
} from "./handlers";

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
};

type Variables = {
  userId: string | null;
  userEmail: string | null;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function handleRequestError(c: Context, error: unknown) {
  if (error instanceof PromptConflictError) {
    return c.json({ error: error.message }, 409);
  }
  if (error instanceof PromptNotFoundError) {
    return c.json({ error: error.message }, 404);
  }
  if (error instanceof Error) {
    return c.json({ error: error.message }, 400);
  }
  throw error;
}

// Auth middleware - extracts JWT if present, allows unauthenticated access
// Individual route handlers enforce auth where required via userId checks
app.use("/api/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    c.set("userId", null);
    c.set("userEmail", null);
    return next();
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || typeof payload !== "object") {
    c.set("userId", null);
    c.set("userEmail", null);
    return next();
  }

  c.set("userId", (payload as Record<string, unknown>).sub as string);
  c.set("userEmail", (payload as Record<string, unknown>).email as string);
  await next();
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

// ============================================================
// Drafts
// ============================================================
app.get("/api/drafts", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await getDraftByUserId(c.env.DB, userId);
  return c.json(result);
});

app.post("/api/drafts", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const config = body.config;

  const result = await saveDraftByUserId(c.env.DB, userId, config);
  return c.json(result, 201);
});

app.delete("/api/drafts", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await deleteDraftByUserId(c.env.DB, userId);
  return c.json(result);
});

// ============================================================
// Prompts
// ============================================================
app.get("/api/prompts", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await getPromptsByUserId(c.env.DB, userId);
  return c.json(result);
});

app.get("/api/prompts/:id", async (c) => {
  const userId = c.get("userId");
  const promptId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await getPromptById(c.env.DB, promptId, userId);
  return c.json(result);
});

app.post("/api/prompts", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const result = await createPrompt(c.env.DB, userId, body);
    return c.json(result, 201);
  } catch (error) {
    return handleRequestError(c, error);
  }
});

app.put("/api/prompts/:id", async (c) => {
  const userId = c.get("userId");
  const promptId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const result = await updatePrompt(c.env.DB, promptId, userId, body);
    return c.json(result);
  } catch (error) {
    return handleRequestError(c, error);
  }
});

app.delete("/api/prompts/:id", async (c) => {
  const userId = c.get("userId");
  const promptId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await deletePrompt(c.env.DB, promptId, userId);
  return c.json(result);
});

app.post("/api/prompts/:id/share", async (c) => {
  const userId = c.get("userId");
  const promptId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const result = await sharePrompt(c.env.DB, promptId, userId, {
      title: body.title,
      description: body.description,
      category: body.category,
      tags: body.tags,
      target_model: body.target_model ?? body.targetModel,
      use_case: body.use_case ?? body.useCase,
    });
    return c.json(result);
  } catch (error) {
    return handleRequestError(c, error);
  }
});

app.post("/api/prompts/:id/unshare", async (c) => {
  const userId = c.get("userId");
  const promptId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await unsharePrompt(c.env.DB, promptId, userId);
  return c.json(result);
});

// ============================================================
// Community
// ============================================================
app.get("/api/community", async (c) => {
  const category = c.req.query("category");
  const tag = c.req.query("tag");
  const sort = c.req.query("sort") || "new";
  const search = c.req.query("search");
  const cursor = c.req.query("cursor");
  const page = parseInt(c.req.query("page") || "0", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);

  const result = await getCommunityPosts(
    c.env.DB,
    { category, tag, sort, search, cursor, page },
    limit
  );
  return c.json(result);
});

app.get("/api/community/personal", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const page = parseInt(c.req.query("page") || "0", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const result = await getPersonalFeed(c.env.DB, userId, { page, limit });
  return c.json(result);
});

app.post("/api/community/by-ids", async (c) => {
  const body = await c.req.json();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const result = await getCommunityPostsByIds(c.env.DB, ids);
  return c.json(result);
});

app.get("/api/community/:id/remixes", async (c) => {
  const postId = c.req.param("id");
  const result = await getRemixesByPostId(c.env.DB, postId);
  return c.json(result);
});

app.post("/api/community/votes/state", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json([]);
  }

  const body = await c.req.json();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const result = await getVoteStates(c.env.DB, userId, ids);
  return c.json(result);
});

app.post("/api/community/ratings/state", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json([]);
  }

  const body = await c.req.json();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const result = await getRatingStates(c.env.DB, userId, ids);
  return c.json(result);
});

app.get("/api/community/:id", async (c) => {
  const postId = c.req.param("id");
  const result = await getCommunityPostById(c.env.DB, postId);
  return c.json(result);
});

app.post("/api/community/:id/vote", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const voteType = body.voteType;

  const result = await createVote(c.env.DB, postId, userId, voteType);
  return c.json(result);
});

app.delete("/api/community/:id/vote", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const voteType = c.req.query("voteType");
  if (voteType !== "upvote" && voteType !== "verified") {
    return c.json({ error: "Invalid vote type" }, 400);
  }

  const result = await deleteVote(c.env.DB, postId, userId, voteType);
  return c.json(result);
});

app.put("/api/community/:id/rating", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const rating = typeof body.rating === "number" ? body.rating : null;
  const result = await setPromptRating(c.env.DB, postId, userId, rating);
  return c.json(result);
});

app.delete("/api/community/:id/rating", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await setPromptRating(c.env.DB, postId, userId, null);
  return c.json(result);
});

app.get("/api/community/:id/comments", async (c) => {
  const postId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "25", 10);
  const cursor = c.req.query("cursor");
  const result = await getCommentsByPostId(c.env.DB, postId, { limit, cursor });
  return c.json(result);
});

app.post("/api/community/:id/comments", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const result = await createComment(c.env.DB, postId, userId, body.body);
  return c.json(result, 201);
});

app.put("/api/community/comments/:id", async (c) => {
  const userId = c.get("userId");
  const commentId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const result = await updateComment(c.env.DB, commentId, userId, body.body);
  return c.json(result);
});

app.delete("/api/community/comments/:id", async (c) => {
  const userId = c.get("userId");
  const commentId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await deleteComment(c.env.DB, commentId, userId);
  return c.json(result);
});

// ============================================================
// Profiles
// ============================================================
app.get("/api/profile/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await getProfileByUserId(c.env.DB, userId);
  return c.json(result);
});

app.put("/api/profile/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const result = await updateProfile(c.env.DB, userId, body);
    return c.json(result);
  } catch (error) {
    return handleRequestError(c, error);
  }
});

app.post("/api/profiles/by-ids", async (c) => {
  const body = await c.req.json();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const result = await getProfilesByUserIds(c.env.DB, ids);
  return c.json(result);
});

app.get("/api/profiles/:id", async (c) => {
  const profileId = c.req.param("id");
  const result = await getProfileByUserId(c.env.DB, profileId);
  return c.json(result);
});

app.get("/api/profiles/:id/posts", async (c) => {
  const profileId = c.req.param("id");
  const page = parseInt(c.req.query("page") || "0", 10);
  const limit = parseInt(c.req.query("limit") || "25", 10);
  const result = await getPostsByAuthor(c.env.DB, profileId, { page, limit });
  return c.json(result);
});

app.get("/api/profiles/:id/follow-stats", async (c) => {
  const profileId = c.req.param("id");
  const result = await getFollowStats(c.env.DB, profileId);
  return c.json(result);
});

app.get("/api/profiles/:id/activity", async (c) => {
  const profileId = c.req.param("id");
  const result = await getProfileActivityStats(c.env.DB, profileId);
  return c.json(result);
});

app.get("/api/follows", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await getFollowingUserIds(c.env.DB, userId);
  return c.json(result);
});

app.get("/api/follows/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ following: false });
  }

  const targetUserId = c.req.param("id");
  const result = await isFollowingUser(c.env.DB, userId, targetUserId);
  return c.json(result);
});

app.put("/api/follows/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const targetUserId = c.req.param("id");
  const result = await followUser(c.env.DB, userId, targetUserId);
  return c.json(result);
});

app.delete("/api/follows/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const targetUserId = c.req.param("id");
  const result = await unfollowUser(c.env.DB, userId, targetUserId);
  return c.json(result);
});

app.get("/api/moderation/blocks", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await getBlockedUserIds(c.env.DB, userId);
  return c.json(result);
});

app.put("/api/moderation/blocks/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const blockedUserId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const result = await blockUser(c.env.DB, userId, blockedUserId, reason);
  return c.json(result);
});

app.delete("/api/moderation/blocks/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const blockedUserId = c.req.param("id");
  const result = await unblockUser(c.env.DB, userId, blockedUserId);
  return c.json(result);
});

app.post("/api/moderation/reports", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const targetType = body.targetType;
  if (targetType !== "post" && targetType !== "comment") {
    return c.json({ error: "Invalid report target type" }, 400);
  }

  const result = await createCommunityReport(c.env.DB, userId, {
    target_type: targetType,
    post_id: typeof body.postId === "string" ? body.postId : null,
    comment_id: typeof body.commentId === "string" ? body.commentId : null,
    reported_user_id: typeof body.reportedUserId === "string" ? body.reportedUserId : null,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    details: typeof body.details === "string" ? body.details : undefined,
  });
  return c.json(result, 201);
});

app.get("/api/notifications", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limit = parseInt(c.req.query("limit") || "25", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const result = await getNotifications(c.env.DB, userId, limit, offset);
  return c.json(result);
});

app.get("/api/notifications/unread-count", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ count: 0 });
  }

  const result = await getUnreadNotificationCount(c.env.DB, userId);
  return c.json(result);
});

app.post("/api/notifications/:id/read", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const notificationId = c.req.param("id");
  const result = await markNotificationRead(c.env.DB, userId, notificationId);
  return c.json(result);
});

app.post("/api/notifications/read-all", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await markAllNotificationsRead(c.env.DB, userId);
  return c.json(result);
});

app.post("/api/support/contact", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const result = await createContactMessage(c.env.DB, {
    first_name: body.firstName,
    last_name: body.lastName,
    email: body.email,
    phone_country: body.phoneCountry,
    phone_number: body.phoneNumber,
    message: body.message,
    requester_user_id: userId,
    privacy_consent: Boolean(body.privacyConsent),
  });
  return c.json(result, 201);
});

app.get("/api/support/reviewer", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ allowed: false });
  }

  const result = await getSupportReviewerAccess(c.env.DB, userId);
  return c.json(result);
});

app.get("/api/support/messages", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const allowed = await getSupportReviewerAccess(c.env.DB, userId);
  if (!allowed.allowed) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const limit = parseInt(c.req.query("limit") || "100", 10);
  const result = await listContactMessages(c.env.DB, limit);
  return c.json(result);
});

app.put("/api/support/messages/:id/status", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const allowed = await getSupportReviewerAccess(c.env.DB, userId);
  if (!allowed.allowed) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const messageId = c.req.param("id");
  const body = await c.req.json();
  const status = body.status;
  if (status !== "new" && status !== "reviewing" && status !== "resolved") {
    return c.json({ error: "Invalid support message status" }, 400);
  }

  const result = await updateContactMessageStatus(c.env.DB, messageId, status);
  return c.json(result);
});

// ============================================================
// Prompt Versions
// ============================================================
app.get("/api/versions", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await c.env.DB
    .prepare(
      `SELECT id, name, prompt, created_at
       FROM prompt_versions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .bind(userId)
    .all();

  return c.json(result.results || []);
});

app.post("/api/versions", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const name = (body.name || "Version").trim().slice(0, 200);
  const prompt = (body.prompt || "").trim();

  await c.env.DB
    .prepare(
      `INSERT INTO prompt_versions (id, user_id, name, prompt, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, userId, name, prompt, now)
    .run();

  return c.json({ id, name, prompt, created_at: now }, 201);
});

// ============================================================
// Bulk operations
// ============================================================
app.post("/api/prompts/bulk-delete", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const ids: string[] = body.ids || [];
  if (ids.length === 0) {
    return c.json({ deleted: [] });
  }

  for (const id of ids) {
    await deletePrompt(c.env.DB, id, userId);
  }

  return c.json({ deleted: ids });
});

app.post("/api/prompts/bulk-unshare", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const ids: string[] = body.ids || [];
  if (ids.length === 0) {
    return c.json({ unshared: [] });
  }

  for (const id of ids) {
    await unsharePrompt(c.env.DB, id, userId);
  }

  return c.json({ unshared: ids });
});

export default app;
