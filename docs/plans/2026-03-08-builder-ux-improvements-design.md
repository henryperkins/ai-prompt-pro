# Builder UX Improvements Design

Date: 2026-03-08
Status: Draft

## Problem Statement

The Prompt Builder form (Phase 1 Zone layout) has 12 identified UX issues ranging from hidden state, missing feedback, and visual noise to conflicting options and under-surfaced AI ownership. This design addresses all of them in a single coordinated pass.

## Scope

All changes target the Phase 1 Zone layout only. Legacy accordion layout is not modified. No backend changes required — all improvements are frontend component and logic changes.

## Changes

### 1. Prompt Textarea — Auto-resize + Limit Indicator

**Files:** `BuilderHeroInput.tsx`

**Current:** Static `min-h-28 resize-y` textarea. Shows `{value.length} chars` with no limit context.

**Change:**
- Replace `resize-y` with auto-grow behavior: a `useEffect` that sets `textarea.style.height = textarea.scrollHeight + "px"` on value change, with a `max-h-[60vh]` cap and `overflow-y-auto` beyond that.
- Change the char counter to `{value.length.toLocaleString()} / 32,000` format.
- When `value.length > 28000`, add `text-warning-primary` color class to the counter.
- When `value.length > 31000`, add `text-error-primary` and show a small inline warning: "Approaching limit".
- Remove the manual `resize-y` class.

### 2. Suggestion Chips — Deferred Rendering + Descriptions

**Files:** `BuilderHeroInput.tsx`

**Current:** The dashed-border "Smart suggestions" box renders immediately with placeholder text. Chips show `chip.label` only.

**Change:**
- Do not render the suggestions container at all until one of: (a) `isInferringSuggestions` is true, (b) `suggestionChips.length > 0`, or (c) `canResetInferred` is true.
- When the container first appears, use a simple CSS `animate-in fade-in slide-in-from-bottom-2 duration-200` entrance.
- Render each chip as a two-line element: `chip.label` as the primary text (semibold) and `chip.description` as secondary text (muted, text-xs) beneath it. Use a vertical stack inside each chip button.
- Keep chips at `max-w-[220px]` to prevent overly wide chips and use `text-left` alignment.

### 3. Tone Default — Explicit Unset State

**Files:** `prompt-builder.ts`, `BuilderAdjustDetails.tsx`, `builder-inference.ts`

**Current:** `defaultConfig.tone` is `"Professional"` — pre-selected in UI. Model inference skips tone because it appears "set."

**Change:**
- Change `defaultConfig.tone` to `""` (empty string).
- In `buildPrompt()`, only add tone to constraints when `config.tone` is truthy and not empty. Already works this way due to `config.tone !== defaultConfig.tone` check — but with default now `""`, "Professional" would be included when explicitly chosen. Good.
- In `BuilderAdjustDetails.tsx` tone chip section: when no tone is selected, show a muted hint below the chips: "No tone selected — the model will decide."
- In `scorePrompt()`: the structure score check `if (config.tone)` already handles empty string correctly (falsy). The tip "Select a role, tone, and constraints" will now correctly fire when tone is unset.
- Migration: in `normalizeTemplateConfig` and `prompt-config-adapters.ts`, map legacy `tone: "Professional"` to `""` on hydration so existing saved configs don't break.

### 4. Conflicting Constraints — Mutual Exclusion

**Files:** `BuilderAdjustDetails.tsx`, `prompt-builder.ts`

**Current:** "Use formal tone" and "Be conversational" can both be selected. No guard.

**Change:**
- Define exclusion pairs in `prompt-builder.ts`:
  ```ts
  export const constraintExclusions: Record<string, string> = {
    "Use formal tone": "Be conversational",
    "Be conversational": "Use formal tone",
  };
  ```
- In `BuilderAdjustDetails.tsx` `toggleConstraint()`: when adding a constraint, auto-remove its exclusion partner from the array if present.
- No toast or warning needed — the toggle is immediate and obvious. The deselected chip visually changes state.

### 5. Role Select + Custom Input — Clarified Relationship

**Files:** `BuilderAdjustDetails.tsx`

**Current:** Both `Select` and `Input` render side-by-side. Both can have values. `buildPrompt` uses `customRole || role`.

**Change:**
- When the user types into the custom role input (onChange, non-empty value), clear `config.role` to `""`.
- When the user selects a role from the dropdown, clear `config.customRole` to `""`.
- Add a small divider with the word "or" between the select and input: `<p className="text-xs text-center text-muted-foreground">or</p>`.
- This makes the mutual exclusion explicit and visible.

### 6. AI Ownership Indicators in Zone 2

**Files:** `BuilderAdjustDetails.tsx`, `Index.tsx` (prop wiring)

**Current:** `fieldOwnership` state exists in Index.tsx but is never passed to or rendered in Zone 2.

**Change:**
- Pass `fieldOwnership: BuilderFieldOwnershipMap` as a new prop to `BuilderAdjustDetails`.
- For each field section (role, tone, format, length, constraints), when `fieldOwnership[field] === "ai"`, render a small inline indicator: a `Badge` with text "AI" in `brand` color, placed next to the field label.
- Style: `<Badge color="brand" type="pill-color" className="text-[10px] px-1.5 py-0">AI</Badge>`.
- When the user manually changes an AI-owned field, the existing `handleAdjustDetailsUpdate` already flips ownership to `"user"` and the badge disappears on re-render.

### 7. Length Preference — Promoted to Chip Group

**Files:** `BuilderAdjustDetails.tsx`

**Current:** Length is a `Select` dropdown buried mid-form, same visual weight as custom inputs.

**Change:**
- Replace the `Select` with a `Button` chip group (same pattern as Tone).
- Render chips for "Brief", "Standard", "Detailed" with the word count hint as subtitle text inside each chip.
- Place the Length chip group immediately after Tone (before Output Format) since they're related output-shaping controls.
- Remove the `lengthOptions` export from `prompt-builder.ts` (or keep for backward compat) and add `lengthChipOptions` with `{ value, label, hint }` shape.

### 8. Score Tips — AI-Aware Messaging

**Files:** `prompt-builder.ts` (scorePrompt function)

**Current:** Tips say "Select a role, tone, and constraints" even when the model just auto-filled them.

**Change:**
- Add an optional `fieldOwnership?: Partial<Record<string, string>>` parameter to `scorePrompt()`.
- When generating tips:
  - If a field is empty, show the existing tip.
  - If a field is `"ai"` owned, change the tip to reference the AI fill, e.g., "AI suggested a role — review or customize it for better results."
  - If a field is `"user"` owned, suppress the tip for that field (user made a conscious choice).
- This makes tips actionable rather than redundant.

### 9. Hidden Fields — Surface or Deprecate task/complexity

**Files:** `prompt-builder.ts`, `BuilderAdjustDetails.tsx`, `prompt-config-adapters.ts`

**Current:** `config.task` and `config.complexity` have no UI in Phase 1 but affect `buildPrompt()` and `scorePrompt()`.

**Change:**
- **task**: In Phase 1, `originalPrompt` is the canonical task input. On config hydration (loading from storage/preset/template), if `task` has a value but `originalPrompt` is empty, copy `task` into `originalPrompt` and clear `task`. If both have values, append `task` to `originalPrompt` separated by `\n\n`. This is a one-time migration in `normalizeTemplateConfig`.
- **complexity**: Add complexity as a chip group in Zone 2, placed after Length. Three chips: "Simple", "Moderate", "Advanced". Same visual pattern as Tone and Length. Label: "Complexity". This is a small addition since the options already exist in `complexityOptions`.

### 10. Collapsed Zone 2 Summary — Dynamic + Descriptive

**Files:** `BuilderAdjustDetails.tsx`

**Current:** Shows `"0 format options, 0 constraints, tone: Professional."` — looks static and doesn't reflect AI-inferred values well.

**Change:**
- Build summary as a list of non-empty signals only. Examples:
  - No selections: "No details configured yet."
  - Some: "Software Developer, Technical tone, 2 formats, 1 constraint"
  - Full: "UX Designer, Creative tone, Brief, 3 formats, 2 constraints, has examples"
- Truncate at 2 lines with `line-clamp-2`.
- When AI-owned fields exist, append "(AI-suggested)" to the summary.

### 11. Suggestions Container — Only When Needed

Covered by change #2 above. To reiterate:
- Before any inference has run: no suggestions box rendered at all. The textarea stands alone.
- First inference triggers: container animates in from below.
- If prompt drops below 24 chars: container animates out (or immediately hides).
- Error state: show a single-line muted message below the textarea (not inside a boxed container).

### 12. Tone Default Migration Safety

**Files:** `prompt-config-adapters.ts`, `template-store.ts`

When changing the tone default from `"Professional"` to `""`:
- In `normalizeTemplateConfig`: if `config.tone === "Professional"` and this is a V1/V2 config being hydrated, set `tone` to `""`. New configs created after this change will have `tone: ""` naturally.
- In the save path: no change needed — `buildPrompt()` already guards on `config.tone !== defaultConfig.tone`, and with `defaultConfig.tone` now `""`, any explicitly chosen tone (including "Professional") will be included.
- Test: update `builder-inference.test.ts` to verify that the default tone is now `""` and that `inferBuilderFieldsLocally` can now infer tone for prompts that previously had no tone signal.

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `src/components/BuilderHeroInput.tsx` | Auto-resize, limit indicator, deferred suggestions, chip descriptions, animations |
| `src/components/BuilderAdjustDetails.tsx` | AI badges, role mutual exclusion, tone unset state, length chips, complexity chips, constraint exclusion, dynamic summary |
| `src/lib/prompt-builder.ts` | `defaultConfig.tone` to `""`, `constraintExclusions`, `lengthChipOptions`, `scorePrompt` ownership param |
| `src/lib/builder-inference.ts` | Update default tone checks |
| `src/lib/prompt-config-adapters.ts` | Tone migration, task-to-originalPrompt migration |
| `src/lib/template-store.ts` | `normalizeTemplateConfig` tone/task migration |
| `src/pages/Index.tsx` | Pass `fieldOwnership` to Zone 2, adjust default tone references |
| `src/test/builder-inference.test.ts` | Update tone default expectations |
| `src/test/builder-inference-heuristics.test.ts` | No change (shared module unchanged) |

## Out of Scope

- Legacy accordion layout changes
- Backend/agent service changes
- Mobile drawer redesign
- OutputPanel changes
- Save/Share dialog changes
- Fantasy theme changes
