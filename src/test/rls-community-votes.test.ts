import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const describeIfEnv = hasSupabaseEnv ? describe : describe.skip;

if (!hasSupabaseEnv && process.env.CI) {
  describe("community_votes RLS (env)", () => {
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

describeIfEnv("community_votes RLS", () => {
  let admin: ReturnType<typeof createAdminClient>;
  let anon: ReturnType<typeof createAnonClient>;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const user1Email = `rls-user1-${suffix}@example.com`;
  const user2Email = `rls-user2-${suffix}@example.com`;
  const user1Password = `Passw0rd!${suffix}`;
  const user2Password = `Passw0rd!${suffix}`;

  let user1Id = "";
  let user2Id = "";
  let savedPromptId = "";
  let postId = "";
  let voteId = "";

  beforeAll(async () => {
    admin = createAdminClient();
    anon = createAnonClient();

    const { data: user1, error: user1Error } = await admin.auth.admin.createUser({
      email: user1Email,
      password: user1Password,
      email_confirm: true,
    });
    if (user1Error || !user1.user?.id) {
      throw new Error(`Failed to create user1: ${user1Error?.message || "missing id"}`);
    }
    user1Id = user1.user.id;

    const { data: user2, error: user2Error } = await admin.auth.admin.createUser({
      email: user2Email,
      password: user2Password,
      email_confirm: true,
    });
    if (user2Error || !user2.user?.id) {
      throw new Error(`Failed to create user2: ${user2Error?.message || "missing id"}`);
    }
    user2Id = user2.user.id;

    const { data: savedPrompt, error: savedPromptError } = await admin
      .from("saved_prompts")
      .insert({
        user_id: user1Id,
        title: "RLS Test Prompt",
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
        author_id: user1Id,
        title: "RLS Test Post",
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

    const { data: vote, error: voteError } = await admin
      .from("community_votes")
      .insert({
        post_id: postId,
        user_id: user1Id,
        vote_type: "upvote",
      })
      .select("id")
      .single();
    if (voteError || !vote?.id) {
      throw new Error(`Failed to create community vote: ${voteError?.message || "missing id"}`);
    }
    voteId = vote.id;
  });

  afterAll(async () => {
    if (voteId) {
      await admin.from("community_votes").delete().eq("id", voteId);
    }
    if (postId) {
      await admin.from("community_posts").delete().eq("id", postId);
    }
    if (savedPromptId) {
      await admin.from("saved_prompts").delete().eq("id", savedPromptId);
    }
    if (user1Id) {
      await admin.auth.admin.deleteUser(user1Id);
    }
    if (user2Id) {
      await admin.auth.admin.deleteUser(user2Id);
    }
  });

  it("does not expose votes to anon or other users", async () => {
    const { data: anonData, error: anonError } = await anon
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(anonError).toBeNull();
    expect(anonData).toEqual([]);

    const user2Client = createAnonClient();
    const { error: signInError } = await user2Client.auth.signInWithPassword({
      email: user2Email,
      password: user2Password,
    });
    if (signInError) {
      throw new Error(`Failed to sign in user2: ${signInError.message}`);
    }

    const { data: otherData, error: otherError } = await user2Client
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(otherError).toBeNull();
    expect(otherData).toEqual([]);
  });

  it("allows the vote owner to read their vote", async () => {
    const user1Client = createAnonClient();
    const { error: signInError } = await user1Client.auth.signInWithPassword({
      email: user1Email,
      password: user1Password,
    });
    if (signInError) {
      throw new Error(`Failed to sign in user1: ${signInError.message}`);
    }

    const { data, error } = await user1Client
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0]?.id).toBe(voteId);
  });
});
