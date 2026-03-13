# Review Findings Remediation Plan

No code edits have landed yet in this pass, so the remaining edits are the full set below.

## Community

1. In [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), replace `relationshipsReady` with separate state for blocked-user loading and following-user loading. Use explicit statuses such as `blockedUsersStatus` and `followingUsersStatus`, plus booleans that tell you whether each source has ever resolved at least once.
2. In the relationship-loading `useEffect` in [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), stop clearing `blockedUserIds` and `followingUserIds` when a signed-in user changes. Only clear them immediately on sign-out.
3. In that same effect, keep the request token, but run `loadBlockedUserIds()` and `loadFollowingUserIds()` as separate async branches instead of one combined `Promise.allSettled()`. Each branch should update only its own status and data.
4. On blocked-user success in [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), replace `blockedUserIds`, set `blockedUsersStatus = "ready"`, and mark blocked-user data as resolved once.
5. On blocked-user failure in [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), keep the previous `blockedUserIds` in memory, set `blockedUsersStatus = "error"`, and do not expose blocked content by falling back to an empty list.
6. Add a page-level boolean in [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx) that means "blocked filtering is safe to render." It should be `true` immediately for signed-out users, and for signed-in users only after blocked-user data has resolved at least once.
7. When blocked filtering is not yet safe, do not render unfiltered posts. Either keep the feed in a loading state or render a protected placeholder, but do not let `visiblePosts` fall through to the raw `posts` array.
8. Pass a readiness prop from [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx) into [CommunityFeed.tsx](/home/azureuser/ai-prompt-pro/src/components/community/CommunityFeed.tsx), and then into [CommunityPostCard.tsx](/home/azureuser/ai-prompt-pro/src/components/community/CommunityPostCard.tsx) and [CommunityPostDetail.tsx](/home/azureuser/ai-prompt-pro/src/components/community/CommunityPostDetail.tsx), so comment threads can also defer rendering blocked-user content until the block list is safe.
9. In [CommunityComments.tsx](/home/azureuser/ai-prompt-pro/src/components/community/CommunityComments.tsx), add a prop like `blockFilterReady`. While it is `false`, do not render `visibleCommentItems` from an empty block list; show the existing loading skeleton or a small "loading protections" placeholder instead.
10. In [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), decouple follow readiness from block readiness. The follow button should depend only on following-state resolution, not on blocked-user resolution.
11. On following-user success in [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), replace `followingUserIds`, set `followingUsersStatus = "ready"`, and mark following data as resolved once.
12. On following-user failure in [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), keep the previous `followingUserIds` set. Do not degrade every card to a fake default "Follow" state.
13. Pass a follow-readiness prop through [CommunityFeed.tsx](/home/azureuser/ai-prompt-pro/src/components/community/CommunityFeed.tsx) into [CommunityPostCard.tsx](/home/azureuser/ai-prompt-pro/src/components/community/CommunityPostCard.tsx). Only render the follow button when following state is ready, or when you still have a prior resolved set to display during refresh.
14. In [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), update `handleTagClick` so it clears both `queryInput` and `query` before applying the tag param. A tag click should not preserve a hidden text search.
15. In [Community.tsx](/home/azureuser/ai-prompt-pro/src/pages/Community.tsx), keep `clearTagFilter` simple: remove the tag param and leave search empty unless the UI explicitly exposes combined filters.
16. Leave [community.ts](/home/azureuser/ai-prompt-pro/src/lib/community.ts) tag support as-is. The bug is the client carrying hidden search state into `loadFeed()`, not the backend tag filter itself.

## Builder And Output Panel

1. In [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx), add two explicit fallback messages: one for "local suggestions available while AI retries" and one for "AI suggestions unavailable right now; retrying automatically."
2. In the inference effect in [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx), compute `const hasLocalFallbackSuggestions = localFallback.suggestionChips.length > 0` before setting `inferenceStatusMessage`.
3. In the retry window branch in [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx), only use the stronger "local suggestions remain available" copy when `hasLocalFallbackSuggestions` is true.
4. In the catch branch in [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx), apply the same conditional message so the UI never promises fallback chips that do not exist.
5. In [BuilderHeroInput.tsx](/home/azureuser/ai-prompt-pro/src/components/BuilderHeroInput.tsx), change `suggestionStatusMessage` so the in-flight degraded copy also depends on `suggestionChips.length > 0`. If there are no chips, use neutral copy like "Refreshing AI suggestions..." or "AI suggestions are temporarily unavailable."
6. In [BuilderHeroInput.tsx](/home/azureuser/ai-prompt-pro/src/components/BuilderHeroInput.tsx), keep the suggestions panel visible only when the message is truthful. If there are no chips and no reset action, either show a neutral status row inside the panel or collapse back to a plain informational line.
7. In [OutputPanelEnhanceControls.tsx](/home/azureuser/ai-prompt-pro/src/components/OutputPanelEnhanceControls.tsx), make the compact disclosure coherent. The collapsed "Edit settings" state should not render `EnhancementPreferencesResetRow` inside the disclosure body.
8. In [OutputPanelEnhanceControls.tsx](/home/azureuser/ai-prompt-pro/src/components/OutputPanelEnhanceControls.tsx), move `EnhancementPreferencesResetRow` inside the `isSettingsExpanded` block, or alternatively mark the disclosure as expanded whenever that row is visible. The cleaner fix is to keep all secondary content behind expansion.
9. If you still want "Most accepted structure" visible while collapsed, move that fact into the always-visible summary area in [OutputPanelEnhanceControls.tsx](/home/azureuser/ai-prompt-pro/src/components/OutputPanelEnhanceControls.tsx) instead of leaving it in the hidden-body slot.
10. In [BuilderHeroInput.tsx](/home/azureuser/ai-prompt-pro/src/components/BuilderHeroInput.tsx), replace the fixed recovery helper copy with conditional copy. Use one sentence when both actions are available, a clear-only sentence when only `Clear prompt` is present, and a reset-only sentence when only `Reset all settings` is present.

## Experiment Drift

1. In [launch-experiments.ts](/home/azureuser/ai-prompt-pro/src/lib/launch-experiments.ts), remove the no-op primary CTA variant if product no longer wants a real A/B treatment.
2. If you remove it, delete `PrimaryCtaVariant`, `PRIMARY_CTA_VARIANTS`, the CTA query/storage constants, the CTA assignment field on `LaunchExperimentAssignments`, and the `getPrimaryCtaVariantLabel()` branching.
3. In [Index.tsx](/home/azureuser/ai-prompt-pro/src/pages/Index.tsx), remove `primaryCtaVariant`, the `useMemo` around `primaryCtaLabel`, and the related `builder_loaded` telemetry fields if the experiment is retired.
4. If analytics still require the field shape, keep the payload key but set `primaryCtaExperimentEnabled: false` and stop emitting a fake variant value.
5. Only keep the CTA experiment machinery if you restore a genuinely different label or interaction for the treatment branch.

## Tests And Verification

1. Update [community-relationship-state.test.tsx](/home/azureuser/ai-prompt-pro/src/test/community-relationship-state.test.tsx) so it now expects blocked posts to remain hidden while block data reloads, and to remain hidden when blocked-user fetch fails.
2. Add a relationship test in [community-relationship-state.test.tsx](/home/azureuser/ai-prompt-pro/src/test/community-relationship-state.test.tsx) that proves follow buttons can render from ready following data even when blocked-user loading is still pending.
3. Update [community-tag-filter-state.test.tsx](/home/azureuser/ai-prompt-pro/src/test/community-tag-filter-state.test.tsx) with a case where the user already has a text search, clicks a tag, and the next `loadFeed()` call receives `tag` only.
4. Add a second tag test in [community-tag-filter-state.test.tsx](/home/azureuser/ai-prompt-pro/src/test/community-tag-filter-state.test.tsx) that clears the tag and verifies the hidden search term does not come back.
5. Add a zero-local-chip fallback case to [builder-hero-input.test.tsx](/home/azureuser/ai-prompt-pro/src/test/builder-hero-input.test.tsx) or [index-inference-cancellation.test.tsx](/home/azureuser/ai-prompt-pro/src/test/index-inference-cancellation.test.tsx).
6. Update [output-panel-enhance-controls.test.tsx](/home/azureuser/ai-prompt-pro/src/test/output-panel-enhance-controls.test.tsx) so the compact settings body is truly collapsed until "Edit settings" is opened.
7. Update [launch-experiments.test.ts](/home/azureuser/ai-prompt-pro/src/test/launch-experiments.test.ts) to match the chosen CTA-experiment direction.
8. Expand [builder.mobile.spec.ts](/home/azureuser/ai-prompt-pro/playwright/builder.mobile.spec.ts) so it covers the compact enhancement settings after the disclosure fix. The key check is that reset/preference details are hidden while collapsed and appear only after the user opens settings.
9. Keep [index-mobile-layout.test.tsx](/home/azureuser/ai-prompt-pro/src/test/index-mobile-layout.test.tsx) lightweight, but do not rely on its `OutputPanel` mock for the compact-settings behavior. That needs either a real unit test or Playwright coverage.

## Run Order

1. Run `npx vitest run src/test/community-relationship-state.test.tsx src/test/community-tag-filter-state.test.tsx`.
2. Run `npx vitest run src/test/builder-hero-input.test.tsx src/test/index-inference-cancellation.test.tsx src/test/output-panel-enhance-controls.test.tsx src/test/launch-experiments.test.ts`.
3. Run `npx playwright test playwright/community.mobile.spec.ts playwright/builder.mobile.spec.ts`.
4. Run `npm run test:unit`.
5. Finish with `npm run check:prod`.
