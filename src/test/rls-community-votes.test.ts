/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRlsClient, hasRlsEnv, registerAndSignIn, rlsEnvErrorMessage } from "./rls-client";

const describeIfEnv = hasRlsEnv ? describe : describe.skip;

if (!hasRlsEnv && process.env.CI) {
  describe("community_votes RLS (env)", () => {
    it("requires RLS env vars", () => {
      throw new Error(rlsEnvErrorMessage);
    });
  });
}

describeIfEnv("community_votes RLS", () => {
  let anonClient: ReturnType<typeof createRlsClient>;
  let user1Client: ReturnType<typeof createRlsClient>;
  let user2Client: ReturnType<typeof createRlsClient>;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const user1Email = `rls-user1-${suffix}@gmail.com`;
  const user2Email = `rls-user2-${suffix}@gmail.com`;
  const user1Password = `Passw0rd!${suffix}`;
  const user2Password = `Passw0rd!${suffix}`;

  let user1Id = "";
  let savedPromptId = "";
  let postId = "";
  let voteId = "";

  beforeAll(async () => {
    anonClient = createRlsClient("rls-votes-anon");
    user1Client = createRlsClient("rls-votes-user1");
    user2Client = createRlsClient("rls-votes-user2");

    user1Id = await registerAndSignIn(user1Client, user1Email, user1Password);
    await registerAndSignIn(user2Client, user2Email, user2Password);

    const { data: savedPrompt, error: savedPromptError } = await user1Client
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

    const { data: post, error: postError } = await user1Client
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

    const { data: vote, error: voteError } = await user1Client
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
      await user1Client.from("community_votes").delete().eq("id", voteId);
    }
    if (postId) {
      await user1Client.from("community_posts").delete().eq("id", postId);
    }
    if (savedPromptId) {
      await user1Client.from("saved_prompts").delete().eq("id", savedPromptId);
    }
    await user1Client.auth.signOut();
    await user2Client.auth.signOut();
  });

  it("does not expose votes to anon or other users", async () => {
    const { data: anonData, error: anonError } = await anonClient
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(anonError).toBeNull();
    expect(anonData).toEqual([]);

    const { data: otherData, error: otherError } = await user2Client
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(otherError).toBeNull();
    expect(otherData).toEqual([]);
  });

  it("allows the vote owner to read their vote", async () => {
    const { data, error } = await user1Client
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0]?.id).toBe(voteId);
  });
});
