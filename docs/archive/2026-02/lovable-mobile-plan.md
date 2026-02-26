

## Condense and Streamline the UI for Mobile

### Problem

The current layout is a long, vertically scrolling page on mobile with every section fully expanded. Users on small screens must scroll through the PromptInput, BuilderTabs, the entire Context & Sources panel (drop zone, structured form, interview, project notes, delimiter toggle, quality meter), Tone controls, Quality Score, and then finally the Output panel. That is a lot of real estate before reaching the "Enhance with AI" button.

### Strategy

Use **collapsible accordion sections** and **mobile-specific layout adjustments** to dramatically reduce the visible surface area, without removing a single feature. Every section remains accessible -- it just defaults to collapsed or is tucked behind a tap.

---

### Changes

#### 1. Compact hero on mobile
**File:** `src/pages/Index.tsx`

- Reduce hero heading from `text-3xl` to `text-xl` on small screens
- Shorten or hide the subtitle paragraph on mobile (`hidden sm:block` or smaller text)
- Reduce `mb-8` to `mb-4` on mobile
- Reduce `py-6` padding to `py-3` on mobile

#### 2. Collapsible accordion layout for the left column
**File:** `src/pages/Index.tsx`

Replace the flat `space-y-6` stack with a Radix **Accordion** (`type="multiple"`) so each major section collapses independently. The sections become:

| Accordion Item | Content | Default State |
|---|---|---|
| "Your Prompt" | `PromptInput` | **Open** (always visible) |
| "Builder" | `BuilderTabs` | Open |
| "Context & Sources" | `ContextPanel` | **Collapsed** |
| "Tone & Style" | `ToneControls` | **Collapsed** |
| "Quality Score" | `QualityScore` | **Collapsed** |

Each trigger shows an icon + label + a small status indicator (e.g., the quality score number, tone selection, source count) so users can see state at a glance without expanding.

This alone removes ~60% of the vertical scroll on mobile while keeping everything one tap away.

#### 3. Sticky "Enhance" button on mobile
**File:** `src/pages/Index.tsx`

On screens below `lg`, move the "Enhance with AI" button out of the Output panel and into a **sticky bottom bar** (`fixed bottom-0 inset-x-0`). This ensures the primary CTA is always reachable without scrolling to the bottom. Hide the `Ctrl+Enter` hint on mobile since there is no keyboard shortcut on phones.

#### 4. Output panel as a bottom sheet on mobile
**Files:** `src/pages/Index.tsx`, `src/components/OutputPanel.tsx`

On mobile (`< lg`), instead of rendering the output panel inline below all the input sections, render it inside a **Drawer** (vaul, already installed). The sticky "Enhance" button triggers both the enhancement AND opens the drawer to show results. A "View output" button in the sticky bar lets users open it on demand.

On desktop (`lg+`), keep the current sticky side panel behavior -- no changes.

#### 5. Condense the Context Panel internals
**File:** `src/components/ContextPanel.tsx`

Replace the flat list of sub-sections (source chips, structured form, interview, project notes, delimiters toggle, quality meter) with a **nested accordion** or **collapsible groups**:

- **Sources** -- always visible (compact chip row + drop zone)
- **Structured fields** -- collapsible, shows count of filled fields as badge
- **Context interview** -- already collapsible (keep as-is)
- **Project notes** -- collapsible, shows "has notes" indicator
- **Settings row** -- Delimiter toggle + quality meter merged into a single compact row

This cuts the Context panel height by roughly half when sub-sections are collapsed.

#### 6. Smaller drop zone on mobile
**File:** `src/components/ContextSourceChips.tsx`

Reduce the drop zone padding from `p-3` to `p-2` on mobile. Make the text smaller. This saves space without removing functionality.

#### 7. Responsive adjustments to existing components

**`src/components/PromptInput.tsx`:**
- Reduce `min-h-[120px]` to `min-h-[80px]` on mobile (it auto-grows anyway)

**`src/components/ToneControls.tsx`:**
- Use smaller buttons (`size="xs"` or reduced padding) on mobile so the button row wraps less

**`src/components/QualityScore.tsx`:**
- Collapse the four score bars into a single-line summary on mobile: "72/100 -- 2 tips" with expand-to-see-details

**`src/components/OutputPanel.tsx`:**
- Reduce min-height of empty state from `min-h-[200px]` to `min-h-[120px]`

**`src/components/TemplateLibrary.tsx`:**
- Use a Drawer instead of Dialog on mobile (responsive pattern already common in shadcn/ui)

**`src/components/VersionHistory.tsx`:**
- Reduce sheet width on mobile (already handles this via `w-[400px] sm:w-[540px]`, but add full-width on very small screens)

#### 8. Global spacing tightening for mobile
**File:** `src/pages/Index.tsx`

- `gap-6` between grid columns becomes `gap-4` on mobile
- `space-y-6` in the left column becomes `space-y-3` on mobile
- Separators between accordion items are removed (the accordion borders serve that purpose)

---

### Technical approach

- **Accordion:** Use the existing `@radix-ui/react-accordion` (already installed) with `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `src/components/ui/accordion.tsx`
- **Drawer:** Use the existing `vaul` Drawer from `src/components/ui/drawer.tsx` for the mobile output panel
- **Responsive detection:** Use the existing `useIsMobile()` hook from `src/hooks/use-mobile.tsx` to conditionally render Drawer vs. inline panel
- **Collapsible:** Use the existing `@radix-ui/react-collapsible` for Context Panel sub-sections
- No new dependencies are needed

### Files to create or modify

| File | Action |
|---|---|
| `src/pages/Index.tsx` | Major refactor -- accordion layout, sticky CTA, drawer for mobile output |
| `src/components/OutputPanel.tsx` | Extract content into a shared component usable in both inline and drawer modes |
| `src/components/ContextPanel.tsx` | Wrap sub-sections in collapsibles with status badges |
| `src/components/ContextSourceChips.tsx` | Tighter mobile spacing |
| `src/components/PromptInput.tsx` | Smaller textarea on mobile |
| `src/components/ToneControls.tsx` | Compact button sizes on mobile |
| `src/components/QualityScore.tsx` | Collapsible detail view on mobile |
| `src/components/TemplateLibrary.tsx` | Drawer on mobile, Dialog on desktop |
| `src/components/VersionHistory.tsx` | Full-width on very small screens |
| `src/components/Header.tsx` | Minor -- tighter padding on mobile |

