# Builder UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 12 UX issues in the Prompt Builder Phase 1 Zone layout — hidden state, missing feedback, visual noise, conflicting options, and under-surfaced AI ownership.

**Architecture:** All changes are frontend-only. The work is organized bottom-up: data layer changes first (prompt-builder.ts, template-store.ts, prompt-config-adapters.ts), then component changes (BuilderHeroInput, BuilderAdjustDetails), then wiring (Index.tsx, usePromptBuilder). Each task is independently testable.

**Tech Stack:** React, TypeScript, Vitest, Tailwind CSS, UUI component library (Button, Badge, Select, Checkbox, Input, Textarea, Switch)

---

### Task 1: Tone Default + Constraint Exclusions (Data Layer)

**Files:**
- Modify: `src/lib/prompt-builder.ts:34` (defaultConfig.tone), `:111-117` (constraintOptions area)
- Test: `src/test/prompt-builder-tone-default.test.ts` (new)

**Step 1: Write failing tests**

Create `src/test/prompt-builder-tone-default.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  constraintExclusions,
  defaultConfig,
  scorePrompt,
} from "@/lib/prompt-builder";

describe("tone default", () => {
  it("defaults to empty string", () => {
    expect(defaultConfig.tone).toBe("");
  });

  it("buildPrompt omits tone constraint when tone is empty", () => {
    const prompt = buildPrompt({ ...defaultConfig, originalPrompt: "Test task" });
    expect(prompt).not.toContain("tone");
  });

  it("buildPrompt includes tone when explicitly set", () => {
    const prompt = buildPrompt({
      ...defaultConfig,
      originalPrompt: "Test task",
      tone: "Professional",
    });
    expect(prompt).toContain("professional tone");
  });

  it("scorePrompt structure score is 0 when tone is empty", () => {
    const score = scorePrompt({ ...defaultConfig, originalPrompt: "Test task" });
    expect(score.structure).toBeLessThan(5);
  });
});

describe("constraintExclusions", () => {
  it("maps formal tone to conversational and vice versa", () => {
    expect(constraintExclusions["Use formal tone"]).toBe("Be conversational");
    expect(constraintExclusions["Be conversational"]).toBe("Use formal tone");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/prompt-builder-tone-default.test.ts`
Expected: FAIL — `defaultConfig.tone` is `"Professional"`, `constraintExclusions` does not exist.

**Step 3: Implement changes in prompt-builder.ts**

In `src/lib/prompt-builder.ts`:

1. Line 34: change `tone: "Professional"` to `tone: ""`
2. Line 35: change `complexity: "Moderate"` to `complexity: ""`
3. After `constraintOptions` array (~line 117), add:
```ts
export const constraintExclusions: Record<string, string> = {
  "Use formal tone": "Be conversational",
  "Be conversational": "Use formal tone",
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/prompt-builder-tone-default.test.ts`
Expected: PASS

**Step 5: Update existing tests that depend on old defaults**

Run: `npx vitest run src/test/builder-inference.test.ts`

The test at line 85 expects `cleared.updates.lengthPreference` to be `"standard"` — this should still pass since `defaultConfig.lengthPreference` is `"standard"`.

The test at line 68 (`applyInferenceUpdates` with tone "Technical") — previously skipped because `config.tone` defaulted to `"Professional"` (non-empty). Now with `""` default, the field is empty so the inference should be applied. Verify the test still passes as-is since it creates `config = { ...defaultConfig }` which now has `tone: ""` and ownership `"empty"`.

Run: `npx vitest run src/test/builder-inference.test.ts src/test/prompt-builder-tone-default.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```
feat: change tone/complexity defaults to empty, add constraint exclusions
```

---

### Task 2: Config Migration (Tone + Task)

**Files:**
- Modify: `src/lib/template-store.ts:198-221` (normalizeTemplateConfig)
- Modify: `src/lib/prompt-config-adapters.ts:116` (hydrateConfigV2 tone fallback)
- Test: `src/test/config-migration-tone-task.test.ts` (new)

**Step 1: Write failing tests**

Create `src/test/config-migration-tone-task.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeTemplateConfig } from "@/lib/template-store";
import { hydrateConfigV1ToWorkingState } from "@/lib/prompt-config-adapters";
import { defaultConfig } from "@/lib/prompt-builder";

describe("tone migration", () => {
  it("normalizeTemplateConfig maps legacy Professional tone to empty", () => {
    const config = { ...defaultConfig, tone: "Professional" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.tone).toBe("");
  });

  it("preserves explicitly chosen non-default tones", () => {
    const config = { ...defaultConfig, tone: "Creative" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.tone).toBe("Creative");
  });

  it("V1 hydration maps Professional tone to empty", () => {
    const raw = { originalPrompt: "test", tone: "Professional" };
    const hydrated = hydrateConfigV1ToWorkingState(raw);
    expect(hydrated.tone).toBe("");
  });
});

describe("task-to-originalPrompt migration", () => {
  it("moves task to originalPrompt when originalPrompt is empty", () => {
    const config = { ...defaultConfig, task: "Write a report", originalPrompt: "" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.originalPrompt).toBe("Write a report");
    expect(normalized.task).toBe("");
  });

  it("appends task to originalPrompt when both have values", () => {
    const config = {
      ...defaultConfig,
      originalPrompt: "Draft an email",
      task: "Include quarterly figures",
    };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.originalPrompt).toContain("Draft an email");
    expect(normalized.originalPrompt).toContain("Include quarterly figures");
    expect(normalized.task).toBe("");
  });

  it("does nothing when task is empty", () => {
    const config = { ...defaultConfig, originalPrompt: "Hello", task: "" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.originalPrompt).toBe("Hello");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/config-migration-tone-task.test.ts`
Expected: FAIL — normalizeTemplateConfig does not migrate tone or task.

**Step 3: Implement migration in normalizeTemplateConfig**

In `src/lib/template-store.ts`, update `normalizeTemplateConfig` (line 198-221). After the existing merge logic and before the return, add migration steps:

```ts
export function normalizeTemplateConfig(
  config: PromptConfig,
  options?: { preserveSourceRawContent?: boolean },
): PromptConfig {
  const merged: PromptConfig = {
    ...defaultConfig,
    ...config,
    contextConfig: mergeContextConfig(config.contextConfig),
    format: Array.isArray(config.format) ? config.format : [],
    constraints: Array.isArray(config.constraints) ? config.constraints : [],
  };

  // Migrate legacy "Professional" tone default to empty
  if (merged.tone === "Professional") {
    merged.tone = "";
  }

  // Migrate legacy "Moderate" complexity default to empty
  if (merged.complexity === "Moderate") {
    merged.complexity = "";
  }

  // Migrate task field into originalPrompt for Phase 1
  if (merged.task.trim()) {
    if (!merged.originalPrompt.trim()) {
      merged.originalPrompt = merged.task.trim();
    } else if (merged.originalPrompt.trim() !== merged.task.trim()) {
      merged.originalPrompt = `${merged.originalPrompt.trim()}\n\n${merged.task.trim()}`;
    }
    merged.task = "";
  }

  return {
    ...merged,
    contextConfig: {
      ...merged.contextConfig,
      sources: merged.contextConfig.sources.map((source) =>
        normalizeSource(source, options?.preserveSourceRawContent === true),
      ),
    },
  };
}
```

In `src/lib/prompt-config-adapters.ts` line 116, change:
```ts
tone: payload.tone || defaultConfig.tone,
```
to:
```ts
tone: payload.tone || "",
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/config-migration-tone-task.test.ts`
Expected: PASS

**Step 5: Run full test suite to check for regressions**

Run: `npx vitest run src/test/builder-inference.test.ts src/test/prompt-builder-tone-default.test.ts src/test/config-migration-tone-task.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```
feat: migrate legacy Professional tone and task field on config hydration
```

---

### Task 3: Score Tips — AI-Aware Messaging

**Files:**
- Modify: `src/lib/prompt-builder.ts:183-248` (scorePrompt)
- Modify: `src/hooks/usePromptBuilder.ts:232` (scorePrompt caller)
- Modify: `src/pages/Index.tsx` (pass fieldOwnership to hook or compute score in page)
- Test: `src/test/score-tips-ownership.test.ts` (new)

**Step 1: Write failing tests**

Create `src/test/score-tips-ownership.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultConfig, scorePrompt } from "@/lib/prompt-builder";

describe("scorePrompt with fieldOwnership", () => {
  it("shows standard tip when field is empty and no ownership", () => {
    const result = scorePrompt({ ...defaultConfig, originalPrompt: "Test task" });
    expect(result.tips.some((t) => t.includes("Select a role"))).toBe(true);
  });

  it("shows AI review tip when field is ai-owned", () => {
    const config = { ...defaultConfig, originalPrompt: "Test task", role: "Developer" };
    const result = scorePrompt(config, { role: "ai" });
    expect(result.tips.some((t) => t.includes("AI suggested"))).toBe(true);
  });

  it("suppresses tip when field is user-owned", () => {
    const config = {
      ...defaultConfig,
      originalPrompt: "Test task",
      role: "Developer",
      tone: "Technical",
      constraints: ["Avoid jargon", "Think step-by-step"],
      format: ["JSON"],
    };
    const result = scorePrompt(config, { role: "user", tone: "user" });
    expect(result.tips.every((t) => !t.includes("Select a role"))).toBe(true);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run src/test/score-tips-ownership.test.ts`
Expected: FAIL — scorePrompt does not accept a second parameter.

**Step 3: Add ownership parameter to scorePrompt**

In `src/lib/prompt-builder.ts`, update the `scorePrompt` signature and tip logic:

```ts
export function scorePrompt(
  config: PromptConfig,
  fieldOwnership?: Partial<Record<string, string>>,
): {
  total: number;
  clarity: number;
  context: number;
  specificity: number;
  structure: number;
  tips: string[];
} {
```

Replace the tip generation lines. For each tip section, check ownership:

For context tip (~line 219):
```ts
if (context < 15) {
  if (fieldOwnership?.role === "ai") {
    tips.push("AI suggested a role — review or customize it for better results.");
  } else if (fieldOwnership?.role !== "user") {
    tips.push("Use the Context & Sources panel to add structured background info.");
  }
}
```

For specificity tip (~line 227):
```ts
if (specificity < 15) {
  const aiFields = ["format", "lengthPreference", "constraints"].filter(
    (f) => fieldOwnership?.[f] === "ai",
  );
  if (aiFields.length > 0) {
    tips.push("AI filled some format details — review them to ensure they match your needs.");
  } else {
    tips.push("Specify output format, length, or provide examples for better results.");
  }
}
```

For structure tip (~line 236):
```ts
if (structure < 15) {
  const aiStructure = ["role", "tone"].filter((f) => fieldOwnership?.[f] === "ai");
  const userStructure = ["role", "tone"].filter((f) => fieldOwnership?.[f] === "user");
  if (aiStructure.length > 0 && userStructure.length === 0) {
    tips.push("AI suggested role and tone — confirm or adjust them for the best structure.");
  } else if (userStructure.length < 2) {
    tips.push("Select a role, tone, and constraints to improve prompt structure.");
  }
}
```

**Step 4: Update usePromptBuilder to accept and forward ownership**

In `src/hooks/usePromptBuilder.ts`, add an optional `fieldOwnership` parameter:

Change line 232:
```ts
const score = useMemo(() => scorePrompt(config), [config]);
```
to:
```ts
const score = useMemo(
  () => scorePrompt(config, fieldOwnership),
  [config, fieldOwnership],
);
```

The hook needs `fieldOwnership` as a parameter. Add it to the hook's interface. In the hook function signature, add:
```ts
export function usePromptBuilder(options?: { fieldOwnership?: Partial<Record<string, string>> }) {
```
And use `options?.fieldOwnership` in the score memo.

In `src/pages/Index.tsx` where `usePromptBuilder` is called, pass the fieldOwnership:
```ts
const { config, updateConfig, ... } = usePromptBuilder({ fieldOwnership });
```

**Step 5: Run tests**

Run: `npx vitest run src/test/score-tips-ownership.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat: make score tips context-aware of AI field ownership
```

---

### Task 4: BuilderHeroInput — Auto-resize + Limit + Deferred Suggestions

**Files:**
- Modify: `src/components/BuilderHeroInput.tsx` (entire component)
- Test: Manual visual verification (component is UI-only, no logic to unit test beyond rendering)

**Step 1: Implement auto-resize textarea**

In `BuilderHeroInput.tsx`, add a ref and auto-resize effect:

```tsx
import { useEffect, useRef } from "react";
// ... existing imports

// Inside the component:
const textareaRef = useRef<HTMLTextAreaElement>(null);

useEffect(() => {
  const el = textareaRef.current;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}, [value]);
```

Update the Textarea:
```tsx
<Textarea
  ref={textareaRef}
  id={promptInputId}
  value={value}
  onChange={(e) => onChange(e.target.value)}
  placeholder="Describe the task in 1-2 sentences. Example: Draft a concise project update for executives using these notes."
  className="min-h-28 max-h-[60vh] overflow-y-auto text-foreground placeholder:text-muted-foreground sm:min-h-32"
  aria-describedby={promptInputMetaId}
/>
```

Remove `resize-y` from className.

**Step 2: Implement limit indicator**

Replace the char counter span:

```tsx
<span
  id={promptInputMetaId}
  className={`text-sm ${
    value.length > 31000
      ? "text-error-primary"
      : value.length > 28000
        ? "text-warning-primary"
        : "text-muted-foreground"
  }`}
>
  {value.length.toLocaleString()} / 32,000
  {value.length > 31000 && (
    <span className="ml-1 text-xs">Approaching limit</span>
  )}
</span>
```

**Step 3: Defer suggestions container + add chip descriptions**

Replace the entire suggestions section (lines 87-151) with:

```tsx
{phase3Enabled && (isInferringSuggestions || suggestionChips.length > 0 || canResetInferred) && (
  <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Smart suggestions
      </p>
      {canResetInferred && onResetInferred && (
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="h-11 px-3 text-sm sm:h-10 sm:px-2.5 sm:text-sm"
          onClick={onResetInferred}
        >
          Reset AI details
        </Button>
      )}
    </div>
    <div className="mt-2 space-y-2">
      {isInferringSuggestions && (
        <p className="flex items-center gap-1.5 text-sm text-foreground/85">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Generating suggestions...
        </p>
      )}
      {suggestionChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestionChips.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              variant="secondary"
              size="sm"
              className="h-auto max-w-[220px] px-2.5 py-1.5 text-left"
              onClick={() => onApplySuggestion?.(chip)}
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{chip.label}</span>
                {chip.description && (
                  <span className="text-xs text-muted-foreground">{chip.description}</span>
                )}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  </div>
)}

{phase3Enabled && hasInferenceError && !isInferringSuggestions && suggestionChips.length === 0 && (
  <p className="text-sm text-muted-foreground">
    AI suggestions are temporarily unavailable.
  </p>
)}
```

Remove the old non-phase3 placeholder block and the always-visible dashed container.

**Step 4: Run lint + type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

**Step 5: Commit**

```
feat: auto-resize textarea, char limit indicator, deferred suggestion chips with descriptions
```

---

### Task 5: BuilderAdjustDetails — Full Overhaul

**Files:**
- Modify: `src/components/BuilderAdjustDetails.tsx` (entire component)
- Modify: `src/lib/prompt-builder.ts` (add `lengthChipOptions`)

**Step 1: Add lengthChipOptions to prompt-builder.ts**

After `lengthOptions` in `src/lib/prompt-builder.ts`:

```ts
export const lengthChipOptions = [
  { value: "brief", label: "Brief", hint: "~100 words" },
  { value: "standard", label: "Standard", hint: "~300 words" },
  { value: "detailed", label: "Detailed", hint: "500+ words" },
];
```

**Step 2: Update BuilderAdjustDetails props and imports**

Add to the interface:

```ts
import type { BuilderFieldOwnershipMap } from "@/lib/builder-inference";
import {
  PromptConfig,
  complexityOptions,
  constraintExclusions,
  constraintOptions,
  formatOptions,
  lengthChipOptions,
  roles,
  toneOptions,
} from "@/lib/prompt-builder";

interface BuilderAdjustDetailsProps {
  config: PromptConfig;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updates: Partial<PromptConfig>) => void;
  fieldOwnership?: BuilderFieldOwnershipMap;
}
```

**Step 3: Add AI badge helper**

Inside the component, add a helper:

```tsx
const aiTag = (field: string) =>
  fieldOwnership?.[field as keyof BuilderFieldOwnershipMap] === "ai" ? (
    <Badge color="brand" type="pill-color" className="ml-1.5 text-[10px] px-1.5 py-0">AI</Badge>
  ) : null;
```

**Step 4: Fix role mutual exclusion**

Update the role select onChange:
```tsx
onSelectionChange={(value) => {
  if (value !== null) {
    onUpdate({ role: String(value), customRole: "" });
  }
}}
```

Update the custom role input onChange:
```tsx
onChange={(value) => onUpdate({ customRole: value, role: value ? "" : config.role })}
```

Add "or" divider between select and input:
```tsx
<p className="text-xs text-center text-muted-foreground">or</p>
```

**Step 5: Fix constraint exclusion**

Update `toggleConstraint`:
```tsx
const toggleConstraint = (constraint: string) => {
  let next = config.constraints.includes(constraint)
    ? config.constraints.filter((entry) => entry !== constraint)
    : [...config.constraints, constraint];
  // Remove mutually exclusive constraint
  const excluded = constraintExclusions[constraint];
  if (excluded && !config.constraints.includes(constraint)) {
    next = next.filter((entry) => entry !== excluded);
  }
  onUpdate({ constraints: next });
};
```

**Step 6: Replace Length Select with chip group**

Replace the Length `<Select>` section with:
```tsx
<div className="space-y-2">
  <Label className="text-sm font-medium text-foreground">
    Length{aiTag("lengthPreference")}
  </Label>
  <div className="flex flex-wrap gap-2">
    {lengthChipOptions.map((option) => (
      <Button
        key={option.value}
        type="button"
        size="sm"
        variant={config.lengthPreference === option.value ? "primary" : "secondary"}
        className="h-auto px-2.5 py-1.5 text-left"
        onClick={() => onUpdate({ lengthPreference: option.value })}
        aria-pressed={config.lengthPreference === option.value}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">{option.label}</span>
          <span className="text-xs text-muted-foreground">{option.hint}</span>
        </span>
      </Button>
    ))}
  </div>
</div>
```

**Step 7: Add Complexity chip group**

After Length, add:
```tsx
<div className="space-y-2">
  <Label className="text-sm font-medium text-foreground">Complexity</Label>
  <div className="flex flex-wrap gap-2">
    {complexityOptions.map((option) => (
      <Button
        key={option}
        type="button"
        size="sm"
        variant={config.complexity === option ? "primary" : "secondary"}
        className="h-11 px-2 text-sm sm:h-9"
        onClick={() => onUpdate({ complexity: option })}
        aria-pressed={config.complexity === option}
      >
        {option}
      </Button>
    ))}
  </div>
</div>
```

**Step 8: Add tone unset hint**

After the tone chip group, add:
```tsx
{!config.tone && (
  <p className="text-xs text-muted-foreground">No tone selected — the model will decide.</p>
)}
```

**Step 9: Add AI badges to all field labels**

Update each `<Label>` to include the aiTag call:
- `AI persona{aiTag("role")}`
- `Tone{aiTag("tone")}`
- `Output format{aiTag("format")}`
- `Length{aiTag("lengthPreference")}`
- `Constraints{aiTag("constraints")}`

**Step 10: Implement dynamic collapsed summary**

Replace the collapsed summary (lines 76-81) with:

```tsx
{!isOpen && (
  <p className="text-sm text-muted-foreground line-clamp-2">
    {(() => {
      const parts: string[] = [];
      if (selectedRole) parts.push(selectedRole);
      if (config.tone) parts.push(`${config.tone} tone`);
      if (config.lengthPreference && config.lengthPreference !== "standard") {
        parts.push(config.lengthPreference.charAt(0).toUpperCase() + config.lengthPreference.slice(1));
      }
      if (formatCount > 0) parts.push(`${formatCount} format${formatCount === 1 ? "" : "s"}`);
      if (constraintCount > 0) parts.push(`${constraintCount} constraint${constraintCount === 1 ? "" : "s"}`);
      if (config.examples.trim()) parts.push("has examples");
      if (config.complexity) parts.push(`${config.complexity} complexity`);
      if (parts.length === 0) return "No details configured yet.";
      const hasAi = fieldOwnership && Object.values(fieldOwnership).some((v) => v === "ai");
      return parts.join(", ") + (hasAi ? " (AI-suggested)" : "");
    })()}
  </p>
)}
```

**Step 11: Run lint + type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

**Step 12: Commit**

```
feat: overhaul BuilderAdjustDetails — AI badges, length/complexity chips, role exclusion, constraint exclusion, dynamic summary
```

---

### Task 6: Index.tsx Wiring

**Files:**
- Modify: `src/pages/Index.tsx` (pass fieldOwnership to Zone 2 + usePromptBuilder)

**Step 1: Pass fieldOwnership to usePromptBuilder**

Find the `usePromptBuilder()` call and update to:
```ts
const { config, updateConfig, ... } = usePromptBuilder({ fieldOwnership });
```

Note: `fieldOwnership` state is declared later in the component. If the hook call is before the state declaration, move the `fieldOwnership` useState above the hook call, or pass it to the score computation separately.

Alternative (simpler): Keep `usePromptBuilder()` unchanged. Instead, compute score separately in Index.tsx:
```ts
const scoreWithOwnership = useMemo(
  () => scorePrompt(config, fieldOwnership),
  [config, fieldOwnership],
);
```
And use `scoreWithOwnership` where `score` was used for tips display only. Keep the hook's `score` for the numeric values (they don't change with ownership).

**Step 2: Pass fieldOwnership to BuilderAdjustDetails**

Find the `<BuilderAdjustDetails` JSX and add the prop:
```tsx
<BuilderAdjustDetails
  config={config}
  isOpen={isAdjustDetailsOpen}
  onOpenChange={setIsAdjustDetailsOpen}
  onUpdate={handleAdjustDetailsUpdate}
  fieldOwnership={fieldOwnership}
/>
```

**Step 3: Run type check + lint**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20 && npm run lint 2>&1 | tail -10`
Expected: Clean.

**Step 4: Run existing tests**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: ALL PASS

**Step 5: Commit**

```
feat: wire fieldOwnership to BuilderAdjustDetails and score tips
```

---

### Task 7: Update Existing Tests + Final Verification

**Files:**
- Modify: `src/test/builder-inference.test.ts` (tone default expectations)
- Run: full test suite

**Step 1: Update builder-inference.test.ts if needed**

The test at line 85 expects `cleared.updates.lengthPreference` to be `"standard"` — verify this still holds with `defaultConfig.lengthPreference = "standard"` (unchanged).

The test at line 68 expects tone inference to be applied — with the new empty default, the ownership will be `"empty"` and the field will be empty, so inference should apply. Verify.

Run: `npx vitest run src/test/builder-inference.test.ts`

If the `clearAiOwnedFields` test fails because `cleared.updates.tone` now resets to `""` instead of `"Professional"`:

Update line 87 area — check what `clearAiOwnedFields` returns for tone. In `builder-inference.ts` line 169: `updates.tone = defaultConfig.tone;` — this is now `""`. If the test checks the actual value, update accordingly.

**Step 2: Run full check:prod gate**

Run: `npm run test:unit 2>&1 | tail -30`
Expected: ALL PASS

**Step 3: Run lint**

Run: `npm run lint 2>&1 | tail -10`
Expected: Clean.

**Step 4: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Clean build.

**Step 5: Commit**

```
test: update expectations for new tone/complexity defaults
```

---

## Task Dependency Graph

```
Task 1 (data layer: tone default + exclusions)
  └─> Task 2 (migration: tone + task)
       └─> Task 3 (scorePrompt ownership)
            └─> Task 6 (Index.tsx wiring)
Task 4 (BuilderHeroInput overhaul) — independent
Task 5 (BuilderAdjustDetails overhaul) — depends on Task 1
Task 7 (test fixup + verification) — depends on all above
```

Tasks 4 and 1 can run in parallel. Tasks 4 and 5 can run in parallel once Task 1 is done.
