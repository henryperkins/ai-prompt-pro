/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRlsClient, hasRlsEnv, registerAndSignIn, rlsEnvErrorMessage } from "./rls-client";

const describeIfEnv = hasRlsEnv ? describe : describe.skip;

if (!hasRlsEnv && process.env.CI) {
  describe("community_comments RLS (env)", () => {
    it("requires RLS env vars", () => {
      throw new Error(rlsEnvErrorMessage);
    });
  });
}

describeIfEnv("community_comments RLS", () => {
  let anonClient: ReturnType<typeof createRlsClient>;
  let authorClient: ReturnType<typeof createRlsClient>;
  let commenterClient: ReturnType<typeof createRlsClient>;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const authorEmail = `rls-comments-author-${suffix}@gmail.com`;
  const commenterEmail = `rls-comments-commenter-${suffix}@gmail.com`;
  const authorPassword = `Passw0rd!${suffix}`;
  const commenterPassword = `Passw0rd!${suffix}`;

  let authorId = "";
  let commenterId = "";
  let savedPromptId = "";
  let postId = "";
  let commentId = "";

  beforeAll(async () => {
    anonClient = createRlsClient("rls-comments-anon");
    authorClient = createRlsClient("rls-comments-author");
    commenterClient = createRlsClient("rls-comments-commenter");

    authorId = await registerAndSignIn(authorClient, authorEmail, authorPassword);
    commenterId = await registerAndSignIn(commenterClient, commenterEmail, commenterPassword);

    const { data: savedPrompt, error: savedPromptError } = await authorClient
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

    const { data: post, error: postError } = await authorClient
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

    const { data: comment, error: commentError } = await commenterClient
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
    if (postId) {
      await authorClient.from("community_posts").delete().eq("id", postId);
    }
    if (savedPromptId) {
      await authorClient.from("saved_prompts").delete().eq("id", savedPromptId);
    }
    await authorClient.auth.signOut();
    await commenterClient.auth.signOut();
  });

  it("hides comments after the parent post becomes private", async () => {
    const { data: beforeUnshare, error: beforeError } = await anonClient
      .from("community_comments")
      .select("id")
      .eq("id", commentId);

    expect(beforeError).toBeNull();
    expect(beforeUnshare?.length).toBe(1);
    expect(beforeUnshare?.[0]?.id).toBe(commentId);

    const { error: unshareError } = await authorClient
      .from("community_posts")
      .update({ is_public: false })
      .eq("id", postId);
    if (unshareError) {
      throw new Error(`Failed to unshare post: ${unshareError.message}`);
    }

    const { data: anonAfter, error: anonAfterError } = await anonClient
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(anonAfterError).toBeNull();
    expect(anonAfter).toEqual([]);

    const { data: commenterAfter, error: commenterAfterError } = await commenterClient
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(commenterAfterError).toBeNull();
    expect(commenterAfter).toEqual([]);

    // Re-sharing verifies the row still exists without relying on admin bypass access.
    const { error: reshareError } = await authorClient
      .from("community_posts")
      .update({ is_public: true })
      .eq("id", postId);
    if (reshareError) {
      throw new Error(`Failed to re-share post: ${reshareError.message}`);
    }

    const { data: afterReshare, error: afterReshareError } = await anonClient
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(afterReshareError).toBeNull();
    expect(afterReshare?.length).toBe(1);
    expect(afterReshare?.[0]?.id).toBe(commentId);
  });
});
