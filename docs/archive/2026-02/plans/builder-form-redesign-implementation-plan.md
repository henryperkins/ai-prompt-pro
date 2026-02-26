# Builder Form Redesign Implementation Plan

## Objective
Implement the four-phase redesign to simplify the builder UX, preserve backward compatibility for saved prompt data, and add AI-assisted inference without regressing current enhancement, persistence, remix, and sharing workflows.

This plan assumes the existing architecture in:
- `src/pages/Index.tsx`
- `src/components/BuilderTabs.tsx`
- `src/components/ContextPanel.tsx`
- `src/components/OutputPanel.tsx`
- `src/hooks/usePromptBuilder.ts`
- `src/lib/prompt-builder.ts`
- `src/lib/context-types.ts`
- `src/lib/section-health.ts`
- `src/lib/ai-client.ts`

## Scope
- Replace nested accordion/tab-heavy builder UX with three-zone progressive disclosure.
- Simplify output actions and save flows.
- Add AI-driven smart suggestions + auto-inferred detail fields.
- Migrate from current state model safely to a simplified long-term model.

## Non-goals
- Replacing the enhancement model or streaming protocol.
- Rebuilding persistence backend schema in one destructive step.
- Removing advanced DB/RAG capabilities.

## Guiding Constraints
- Preserve existing saved prompts/templates/remix records.
- Preserve mobile drawer preview and `Ctrl+Enter` enhance behavior.
- Keep advanced features available but deeply hidden.
- Ship incrementally behind feature flags with rollback.

## Cross-Cutting Workstreams (All Phases)

### 1) Feature Flags and Rollout Control
Add app-level flags to enable staged rollout and rollback:
- `builderRedesignPhase1`
- `builderRedesignPhase2`
- `builderRedesignPhase3`
- `builderRedesignPhase4`

Implementation points:
- Add env-driven flag helper in `src/lib` (or existing config layer).
- Gate new UI paths in `src/pages/Index.tsx`.
- Keep old UI path available until Phase 4 exit.

### 2) Telemetry
Add events to evaluate success and catch regressions:
- `builder_loaded`
- `builder_first_input`
- `builder_zone2_opened`
- `builder_zone3_opened`
- `builder_enhance_clicked`
- `builder_enhance_completed`
- `builder_inference_applied`
- `builder_field_manual_override`
- `builder_save_clicked`
- `builder_share_toggled`
- `builder_dev_export_used`

Track funnel metrics:
- Time to first enhance.
- Enhance success/failure rate.
- Save conversion rate.
- Share conversion rate.
- Advanced settings usage.

### 3) Compatibility Layer
Introduce model adapters before removing old fields:
- `hydrateConfigV1ToWorkingState`
- `serializeWorkingStateToV1` (temporary)
- `serializeWorkingStateToV2` (Phase 4 target)

Use adapters in:
- `usePromptBuilder` load/save flow.
- remix payload preparation.
- prompt builder functions.

### 4) Testing Baseline
Expand tests in `src/test/` before major edits:
- Snapshot/behavior tests for `buildPrompt`.
- Validation tests for save/share.
- Component tests for builder visibility progression.
- Regression tests for persistence hydration.

---

## Phase 1: UI Flattening + Progressive Disclosure (No Model Breakage)

### Goal
Deliver the new three-zone interaction pattern while keeping existing data shape and backend behavior intact.

### Deliverables
1. `Index` layout restructured into zones:
- Zone 1: always-visible hero input (`originalPrompt`).
- Zone 2: collapsed “Adjust details” panel.
- Zone 3: hidden “Add sources or advanced settings”.

2. Remove nested tab navigation from default path:
- Replace `BuilderTabs` usage with flat controls for:
  - role (combo behavior using existing `role` + `customRole`)
  - tone
  - format
  - length
  - constraints
  - examples
- Keep existing components available behind flag fallback path.

3. Context simplification in default path:
- Keep source chips accessible in Zone 3.
- Hide integrations and delimiters under “Show advanced”.
- Hide interview and structured context UI in redesigned path.

4. Section health badges removed from redesigned path:
- No `SectionHealthBadge` in new triggers.
- Keep `QualityScore` available as compact read-only signal.

### Implementation Tasks

#### A. Build new zone components
Create components:
- `src/components/BuilderHeroInput.tsx`
- `src/components/BuilderAdjustDetails.tsx`
- `src/components/BuilderSourcesAdvanced.tsx`

Responsibilities:
- `BuilderHeroInput`: prompt textarea + smart suggestion placeholder container (non-AI stub in Phase 1).
- `BuilderAdjustDetails`: flattened controls mapped to existing `PromptConfig`.
- `BuilderSourcesAdvanced`: source chips, optional project notes, advanced toggle with integrations + delimiter.

#### B. Integrate in `Index.tsx`
- Add redesigned branch under `builderRedesignPhase1`.
- Preserve current desktop/mobile output panel behavior.
- Preserve enhance handlers and remix banner.
- Preserve `Ctrl+Enter` behavior.

#### C. Prompt scoring and quality placement
- Keep `scorePrompt` unchanged in Phase 1 for stability.
- Render quality as compact summary near output rather than dedicated accordion in redesigned path.

### Data Mapping (Phase 1 temporary)
Map redesigned controls to existing fields:
- AI persona -> `role`/`customRole`
- prompt description -> `originalPrompt` (and not `task`)
- output format -> `format` + optional `customFormat`
- avoid tags -> `constraints` + optional `customConstraint`
- tone -> `tone`
- length -> `lengthPreference`
- example -> `examples`

Retain old fields in state for compatibility but stop exposing:
- `task`
- `contextConfig.structured.*`
- `contextConfig.interviewAnswers`
- `complexity` (hidden default)

### Acceptance Criteria
- User can complete end-to-end flow (input -> enhance -> copy/save/share) from redesigned path.
- No use of nested tabs in redesigned path.
- Advanced integrations remain available and functional.
- Old prompts load and still enhance successfully.

### Test Plan
- Component tests for zone visibility rules.
- Keyboard shortcut test.
- Prompt build regression test for unchanged defaults.
- Mobile drawer smoke tests.

---

## Phase 2: Output Panel Simplification

### Goal
Reduce action complexity by unifying save flows and grouping developer actions.

### Deliverables
1. Single Save dialog:
- Replace separate “Save Prompt” and “Save & Share”.
- Add `Share to community` toggle.
- Conditionally show share-only required fields (`useCase`, safety confirmation, optional target model).

2. Compare changes as inline control:
- Move out of “More”.
- Show only when diff exists.

3. Developer tools submenu:
- Group codex exports, SKILL/AGENTS downloads under a labeled submenu.
- Keep non-developer options in main menu.

### Implementation Tasks

#### A. Refactor `OutputPanel.tsx`
- Replace dual dialog state with one form state:
  - base fields: title/category/description/tags/remixNote
  - share extension fields behind toggle
- Internally route submit:
  - toggle off -> `onSavePrompt`
  - toggle on -> `onSaveAndSharePrompt`

#### B. Validation refactor
- Update/extend `src/lib/output-panel-validation.ts`:
  - base validation shared.
  - share validation conditionally applied.

#### C. UX behavior
- Keep `Save Version` accessible.
- Keep `Copy` and `Enhance` unchanged.
- Add simple `Show changes` button/toggle near header.

### Acceptance Criteria
- No separate share dialog remains in redesigned path.
- Save-to-share toggle works with required validation.
- Existing persistence/share API calls unchanged and successful.

### Test Plan
- Form validation matrix (save only, save+share).
- Remix mode field behavior tests.
- Compare toggle visibility tests.

---

## Phase 3: AI-Assisted Suggestions + Auto-Inference

### Goal
Make Zone 1 primary and allow AI to populate Zone 2 fields with explicit user override control.

### Deliverables
1. Smart suggestion chips while typing:
- Trigger after prompt length threshold and debounce.
- Suggestions can append prompt text and/or set detail fields.

2. Auto-fill detail fields on first enhance:
- Populate only empty and unlocked fields.
- Auto-expand Zone 2 with “AI-inferred” indicators.

3. Manual override lock behavior:
- Any manual edit marks field as user-owned.
- Later inference does not overwrite locked fields.

4. Reset AI suggestions action:
- Clears inferred values/metadata and allows re-inference.

### Backend/API Work
Add inference endpoint (Supabase Edge Function recommended):
- Function name example: `infer-builder-fields`
- Input:
  - prompt text
  - source summaries (optional)
  - current field values
  - lock metadata
- Output:
  - inferred fields: role/audience/tone/format/length/constraints
  - suggestion chips (label + action type + payload)
  - confidence by field (optional)

Client integration:
- Add `inferBuilderFields` to `src/lib/ai-client.ts`.
- Add response normalizer and timeout/error handling.

### Frontend State Additions
In builder state (likely `usePromptBuilder` or local component state):
- `inferredFields: Partial<...>`
- `fieldOwnership: Record<Field, "ai" | "user" | "empty">`
- `lastInferenceAt`
- `suggestionChips`

Behavior rules:
- On typing threshold: update chips only.
- On first enhance: apply inferred values to unlocked fields before `buildPrompt`.
- On manual edit: set ownership to `user`.
- On reset: clear `ai` ownership + inferred values.

### Prompt Composition Updates
Extend `buildPrompt` inputs to include newly inferred audience context without requiring structured/interview UI:
- Feed audience/subject constraints into context block equivalent.
- Preserve advanced DB/RAG/project notes inclusion.

### Acceptance Criteria
- Smart suggestions appear and are actionable.
- Inference fills details only when appropriate.
- Manual edits persist across subsequent enhances.
- Inference failures degrade gracefully to manual-only flow.

### Test Plan
- Debounce + threshold tests.
- Field lock semantics tests.
- First-enhance inference application tests.
- Error fallback tests.

---

## Phase 4: Schema Simplification + Data Migration

### Goal
Retire obsolete fields and converge on a simplified long-term prompt config schema.

### Target Schema (Proposed)
```ts
interface PromptConfigV2 {
  originalPrompt: string;
  role: string;
  audience: string;
  tone: string;
  format: string[];
  lengthPreference: "brief" | "standard" | "detailed";
  constraints: string[];
  examples: string;
  sources: ContextSource[];
  projectNotes: string;
  advanced: {
    useDelimiters: boolean;
    databaseConnections: DatabaseConnection[];
    rag: RagParameters;
  };
  aiMeta?: {
    fieldOwnership: Record<string, "ai" | "user" | "empty">;
    inferredAt?: number;
  };
}
```

### Migration Strategy
1. Dual-read / dual-write window:
- On load: hydrate V1 or V2 into working model.
- On save: write V2 while preserving compatibility fields as needed.

2. Backfill mapper rules:
- `task` + `originalPrompt` -> `originalPrompt` (prefer non-empty `originalPrompt`, append task when distinct).
- `customRole` override merged into `role`.
- `customFormat` merged into `format`.
- `customConstraint` merged into `constraints`.
- `contextConfig.structured.audience` -> `audience`.
- `complexity` dropped (or kept only as hidden compatibility metadata).
- structured/interview leftovers folded into prompt text hints if needed.

3. Persistence updates:
- Update load/save adapters in persistence layer and cache hydration paths.
- Ensure historical versions remain renderable.
- Keep immutable old records valid through adapter, not destructive migration.

4. Cleanup:
- Remove deprecated UI and old dead fields after adoption threshold.
- Remove section health logic or repurpose to new model signals.

### Acceptance Criteria
- All historical saved prompts load correctly under V2.
- New saves produce V2 config.
- Old exports still functional through compatibility serializer where required.
- No regressions in remix/share.

### Test Plan
- Migration fixture tests (V1 -> V2).
- Persistence round-trip tests.
- Remix load/save tests with old and new records.
- Backward compatibility tests for `buildPrompt`.

---

## Dependency Graph and Sequence
1. Feature flags + telemetry scaffolding.
2. Phase 1 UI shell replacement with old model mapping.
3. Phase 2 output panel simplification.
4. Phase 3 inference endpoint + client + field ownership.
5. Phase 4 schema migration + adapter cleanup.

Do not start Phase 4 before Phase 3 telemetry confirms stable usage.

---

## Risk Register

1. **Persistence breakage risk**
- Mitigation: adapters + fixture tests for old records.

2. **Inference quality inconsistency**
- Mitigation: confidence gating, user override lock, reset action.

3. **UX regression on mobile**
- Mitigation: dedicated mobile snapshots and interaction tests.

4. **Overwriting user intent**
- Mitigation: strict ownership model (`ai` vs `user`), no overwrite of user fields.

5. **Advanced user workflow regression**
- Mitigation: keep DB/RAG feature parity under advanced section.

---

## QA Matrix

### Functional
- Input -> enhance -> copy/save/share.
- Remix load -> edit -> save/share.
- Source add/remove (text/url/file).
- Advanced DB/RAG config persists and renders in built prompt.

### Compatibility
- Load old local draft.
- Load old saved prompt from persistence.
- Load old version history entry and restore.

### UX
- Zone visibility and transitions.
- Suggestion chips behavior.
- AI badge and manual override behavior.

### Performance
- Typing latency in hero textarea.
- Debounced inference call frequency.
- Output panel render under streaming updates.

---

## Release Plan

### Milestone A (Phase 1 + flags)
- Internal QA only.
- Default-off flag.

### Milestone B (Phase 2)
- Internal + small beta cohort.
- Collect save/share conversion metrics.

### Milestone C (Phase 3)
- Controlled rollout with inference endpoint monitoring.
- Add kill-switch for inference only.

### Milestone D (Phase 4)
- After migration confidence and telemetry thresholds met.
- Remove deprecated code path in follow-up cleanup PR.

---

## Estimated Work Breakdown (Engineering)
- Phase 1: 4-6 days (UI restructure + tests).
- Phase 2: 2-3 days (output form/state refactor + tests).
- Phase 3: 5-8 days (backend inference + client/state/UI + tests).
- Phase 4: 4-6 days (migration adapters + persistence compatibility + cleanup).

Total: ~3 to 4 weeks depending on QA bandwidth and inference endpoint readiness.

---

## Definition of Done (Program-Level)
- Redesigned builder path is default-on.
- Completion funnel improves versus baseline.
- No critical regressions in persistence/remix/share.
- Legacy adapter remains in place for historical data.
- Old UI path removed only after validation period and rollback window.
