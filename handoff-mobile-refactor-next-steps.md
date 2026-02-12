Use this as the handoff prompt in a new conversation:

```text
Continue the mobile Community/Social refactor in `/home/azureuser/ai-prompt-pro`.

Context:
- Phases 1–6 were implemented (mobile touch targets, safe-area fixes, filter bottom sheet, compact feed cards, comment thread drawers, one-tap mobile notifications).
- Updated files include:
  - `src/pages/Community.tsx`
  - `src/pages/CommunityPost.tsx`
  - `src/components/PageShell.tsx`
  - `src/components/BottomNav.tsx`
  - `src/components/Header.tsx`
  - `src/components/NotificationPanel.tsx`
  - `src/components/community/CommunityFeed.tsx`
  - `src/components/community/CommunityPostCard.tsx`
  - `src/components/community/CommunityPostDetail.tsx`
  - `src/components/community/CommunityComments.tsx`
  - `src/components/community/PromptPreviewPanel.tsx`
  - `playwright/community.mobile.spec.ts`
- Validation already passing: `npm run lint`, `npm test`, `npm run test:mobile`, `npm run check:prod`.

What I want now (Phase 7 quality + rollout readiness):
1. Add/expand Vitest coverage for new mobile behaviors:
   - Filter drawer open/close/select semantics in `Community`.
   - Comment thread drawer flow in card and post detail.
   - Mobile notifications one-tap drawer flow in `Header`.
2. Harden Playwright mobile checks:
   - Keep 320/375/390/428 baselines.
   - Assert no controls under 44px for critical actions.
   - Assert no bottom-nav overlap/safe-area clipping in Community and CommunityPost.
3. Add feature-flagged rollout for the new mobile UX:
   - Introduce a dedicated flag (for Community mobile enhancements) and gate new mobile-specific behavior.
   - Keep desktop behavior unchanged.
4. Add telemetry hooks for success metrics:
   - Mobile first meaningful action time proxy in Community.
   - Comment/reaction interaction events per mobile session.
5. Produce a short QA checklist doc for manual iOS Safari + Android Chrome verification.

Constraints:
- Run `query_project` first (if unavailable, fall back to `rg` + direct inspection).
- Don’t revert unrelated workspace changes.
- Keep 44px minimum target size for critical controls.
- Preserve desktop UX and existing design language.
- Keep changes production-safe and test-backed.

Definition of done:
- All tests pass (`npm run lint`, `npm test`, `npm run test:mobile`, `npm run check:prod`).
- New tests exist for mobile filter/comments/notifications behavior.
- Mobile feature flag exists and is wired.
- Telemetry events are added for the two success metrics.
- Provide a concise summary with file-by-file changes and any residual risks.
```
