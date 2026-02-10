import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const describeIfEnv = hasSupabaseEnv ? describe : describe.skip;

if (!hasSupabaseEnv && process.env.CI) {
  describe("community_comments RLS (env)", () => {
    it("requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY", () => {
      throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY for RLS tests.");
    });
  });
}

function createAdminClient() {
  return createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function createAnonClient() {
  return createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

describeIfEnv("community_comments RLS", () => {
  let admin: ReturnType<typeof createAdminClient>;
  let anon: ReturnType<typeof createAnonClient>;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const authorEmail = `rls-comments-author-${suffix}@example.com`;
  const commenterEmail = `rls-comments-commenter-${suffix}@example.com`;
  const authorPassword = `Passw0rd!${suffix}`;
  const commenterPassword = `Passw0rd!${suffix}`;

  let authorId = "";
  let commenterId = "";
  let savedPromptId = "";
  let postId = "";
  let commentId = "";

  beforeAll(async () => {
    admin = createAdminClient();
    anon = createAnonClient();

    const { data: author, error: authorError } = await admin.auth.admin.createUser({
      email: authorEmail,
      password: authorPassword,
      email_confirm: true,
    });
    if (authorError || !author.user?.id) {
      throw new Error(`Failed to create author: ${authorError?.message || "missing id"}`);
    }
    authorId = author.user.id;

    const { data: commenter, error: commenterError } = await admin.auth.admin.createUser({
      email: commenterEmail,
      password: commenterPassword,
      email_confirm: true,
    });
    if (commenterError || !commenter.user?.id) {
      throw new Error(`Failed to create commenter: ${commenterError?.message || "missing id"}`);
    }
    commenterId = commenter.user.id;

    const { data: savedPrompt, error: savedPromptError } = await admin
      .from("saved_prompts")
      .insert({
        user_id: authorId,
        title: "RLS Comment Prompt",
        description: "",
        category: "general",
        tags: [],
        config: {},
        built_prompt: "",
        enhanced_prompt: "",
        target_model: "",
        use_case: "",
      })
      .select("id")
      .single();
    if (savedPromptError || !savedPrompt?.id) {
      throw new Error(`Failed to create saved prompt: ${savedPromptError?.message || "missing id"}`);
    }
    savedPromptId = savedPrompt.id;

    const { data: post, error: postError } = await admin
      .from("community_posts")
      .insert({
        saved_prompt_id: savedPromptId,
        author_id: authorId,
        title: "RLS Comment Post",
        enhanced_prompt: "Sample",
        description: "",
        use_case: "",
        category: "general",
        tags: [],
        target_model: "",
        is_public: true,
        public_config: {},
        starter_prompt: "Starter",
        remix_note: "",
        remix_diff: null,
      })
      .select("id")
      .single();
    if (postError || !post?.id) {
      throw new Error(`Failed to create community post: ${postError?.message || "missing id"}`);
    }
    postId = post.id;

    const { data: comment, error: commentError } = await admin
      .from("community_comments")
      .insert({
        post_id: postId,
        user_id: commenterId,
        body: "Visible until unshared",
      })
      .select("id")
      .single();
    if (commentError || !comment?.id) {
      throw new Error(`Failed to create comment: ${commentError?.message || "missing id"}`);
    }
    commentId = comment.id;
  });

  afterAll(async () => {
    if (commentId) {
      await admin.from("community_comments").delete().eq("id", commentId);
    }
    if (postId) {
      await admin.from("community_posts").delete().eq("id", postId);
    }
    if (savedPromptId) {
      await admin.from("saved_prompts").delete().eq("id", savedPromptId);
    }
    if (authorId) {
      await admin.auth.admin.deleteUser(authorId);
    }
    if (commenterId) {
      await admin.auth.admin.deleteUser(commenterId);
    }
  });

  it("hides comments after the parent post becomes private", async () => {
    const { data: beforeUnshare, error: beforeError } = await anon
      .from("community_comments")
      .select("id")
      .eq("id", commentId);

    expect(beforeError).toBeNull();
    expect(beforeUnshare?.length).toBe(1);
    expect(beforeUnshare?.[0]?.id).toBe(commentId);

    const { error: unshareError } = await admin
      .from("community_posts")
      .update({ is_public: false })
      .eq("id", postId);
    if (unshareError) {
      throw new Error(`Failed to unshare post: ${unshareError.message}`);
    }

    const { data: stillStored, error: storedError } = await admin
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(storedError).toBeNull();
    expect(stillStored?.length).toBe(1);

    const { data: anonAfter, error: anonAfterError } = await anon
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(anonAfterError).toBeNull();
    expect(anonAfter).toEqual([]);

    const commenterClient = createAnonClient();
    const { error: signInError } = await commenterClient.auth.signInWithPassword({
      email: commenterEmail,
      password: commenterPassword,
    });
    if (signInError) {
      throw new Error(`Failed to sign in commenter: ${signInError.message}`);
    }

    const { data: commenterAfter, error: commenterAfterError } = await commenterClient
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(commenterAfterError).toBeNull();
    expect(commenterAfter).toEqual([]);
  });
});
