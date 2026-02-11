Plan: Address Remaining UI/UX Issues (Items 1-12)

 Context

 After a comprehensive UI review and a first round of refactoring, 10 unaddressed items and 2 newly introduced issues remain. These range from small component-level fixes (no-op memo, wrong button variant) to a cross-cutting concern (isDark state duplicated across 6 pages). This plan addresses all 12 in priority order grouped by file.

 ---
 Changes

 1. src/components/community/CommunityFeed.tsx

 Item 1: Replace raw <button> with <Button> (line 110-115)

 Replace the "Load more" <button> with <Button variant="outline" size="sm">. Remove the manual classes (interactive-chip h-8 rounded-md border border-border px-3 text-xs...). Keep the disabled logic and labels.

 ---
 2. src/components/community/CommunityComments.tsx

 Item 2: Remove no-op useMemo (line 108)

 Delete const sortedComments = useMemo(() => comments, [comments]); and replace all references to sortedComments with comments directly.

 Item 3: Remove interactive-card from static container (line 111)

 The comments Card is a non-clickable section wrapper. Remove interactive-card from its className. Keep the rest (space-y-3 border-border/80 bg-card/85 p-3).

 Item 4: Change comment submit to variant="default" (line 170-180)

 Change variant="outline" to variant="default" on the "Post comment" button to give it proper primary action weight. Remove interactive-chip class from it (primary buttons don't need chip-style lift).

 ---
 3. src/components/community/PromptPreviewPanel.tsx

 Item 5: Fix gradient fade color mismatch (line 36)

 The panel background is bg-muted/35. The fade gradient uses from-muted/95 which is much darker. Change to:
 from-[hsl(var(--muted)/0.35)]
 This matches the actual panel surface. Also update via-muted/70 to via-[hsl(var(--muted)/0.2)] and keep to-transparent.

 Note: Because the panel accepts a className prop that can override the background (e.g. bg-background/65 on featured cards), the gradient won't be perfect in all cases, but it will be correct for the default surface.

 ---
 4. src/components/OutputPanel.tsx

 Item 6: Replace native checkbox with Radix <Checkbox> (lines 557-561)

 Import Checkbox from @/components/ui/checkbox and Label from @/components/ui/label. Replace:
 <label className="flex items-start gap-2 text-xs text-muted-foreground">
   <input type="checkbox" checked={shareConfirmedSafe} onChange={...} className="mt-0.5" />
   <span>I confirm this prompt contains no secrets or private data.</span>
 </label>
 With:
 <div className="flex items-start gap-2">
   <Checkbox
     id="share-confirm-safe"
     checked={shareConfirmedSafe}
     onCheckedChange={(checked) => setShareConfirmedSafe(checked === true)}
     className="mt-0.5"
   />
   <Label htmlFor="share-confirm-safe" className="text-xs text-muted-foreground leading-snug cursor-pointer">
     I confirm this prompt contains no secrets or private data.
   </Label>
 </div>

 ---
 5. src/components/community/CommunityPostDetail.tsx

 Item 7: Fix action button wrapping on mobile (lines 146-171)

 The 3 action buttons (Remix, Save to Library, Copy prompt) sit in a flex row that wraps poorly on narrow screens. Change the container from:
 <div className="flex items-center gap-2">
 To:
 <div className="flex flex-wrap items-center gap-2 sm:justify-end">
 And add w-full sm:w-auto to each button so they stack full-width on mobile and inline on desktop:
 className="h-8 text-xs w-full sm:w-auto"

 ---
 6. Extract useTheme hook — Eliminate isDark duplication

 Item 8: Create src/hooks/useTheme.tsx

 Currently 6 pages (Index, Community, CommunityPost, Library, History, NotFound) each independently manage:
 const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
 useEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

 Create a context-based hook:

 src/hooks/useTheme.tsx — new file:
 - ThemeProvider wraps children, manages isDark state + the classList.toggle effect in one place
 - useTheme() returns { isDark, toggleTheme }
 - Initial value read from document.documentElement.classList.contains("dark")

 src/App.tsx — wrap <BrowserRouter> with <ThemeProvider>:
 <ThemeProvider>
   <BrowserRouter>...</BrowserRouter>
 </ThemeProvider>

 All 6 pages — replace local isDark state + effect with:
 const { isDark, toggleTheme } = useTheme();
 And update <Header isDark={isDark} onToggleTheme={toggleTheme} />.

 src/components/Header.tsx — no interface change needed. It already receives isDark and onToggleTheme as props.

 ---
 7. src/pages/Community.tsx

 Item 9: Add horizontal scroll affordance to category bar (lines 319-334)

 The category buttons sit in overflow-x-auto with no visual cue that scrolling is possible. Add edge fade masks using CSS pseudo-elements. Wrap the scroll container:

 <div className="category-scroll-fade relative">
   <div className="overflow-x-auto">
     <div className="flex min-w-max items-center gap-1.5 pb-1">
       {/* category buttons */}
     </div>
   </div>
 </div>

 Add to src/index.css in @layer components:
 .category-scroll-fade::after {
   content: "";
   position: absolute;
   right: 0;
   top: 0;
   bottom: 0;
   width: 2rem;
   background: linear-gradient(to right, transparent, hsl(var(--card)));
   pointer-events: none;
   z-index: 1;
 }

 ---
 8. src/pages/Index.tsx

 Item 11: Hide "Enhance first" card when all sections complete or after first enhance

 The "Enhance first, refine after" card (lines 453-472) is always visible. It should disappear once the user has filled all builder sections or after they've enhanced at least once.

 Change the condition from always-rendered to:
 const hasEnhancedOnce = enhancedPrompt.trim().length > 0;
 const allSectionsComplete =
   sectionHealth.builder === "complete" &&
   sectionHealth.context === "complete" &&
   sectionHealth.tone === "complete";
 const showEnhanceFirstCard = !hasEnhancedOnce && !allSectionsComplete;

 Wrap the card:
 {showEnhanceFirstCard && (
   <Card className="border-border/70 bg-card/80 p-3">...</Card>
 )}

 ---
 9. src/components/community/CommunityPostCard.tsx

 Item 12: Fix badge squeeze in card header on narrow screens (lines 86-95)

 When targetModel is long, the badges crowd the author row. Move the badges below the author row on mobile and keep them top-right on desktop:

 Change the outer container from:
 <div className="flex items-start justify-between gap-3">
 To a stacked layout on mobile:
 <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">

 And add self-start to the badges container so they left-align on mobile:
 <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto sm:justify-end">

 ---
 Files Modified (summary)
 ┌──────────────────────────────────────────────────┬─────────┐
 │                       File                       │  Items  │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/components/community/CommunityFeed.tsx       │ 1       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/components/community/CommunityComments.tsx   │ 2, 3, 4 │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/components/community/PromptPreviewPanel.tsx  │ 5       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/components/OutputPanel.tsx                   │ 6       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/components/community/CommunityPostDetail.tsx │ 7       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/hooks/useTheme.tsx (new)                     │ 8       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/App.tsx                                      │ 8       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/pages/Index.tsx                              │ 8, 11   │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/pages/Community.tsx                          │ 8, 9    │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/pages/CommunityPost.tsx                      │ 8       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/pages/Library.tsx                            │ 8       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/pages/History.tsx                            │ 8       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/pages/NotFound.tsx                           │ 8       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/index.css                                    │ 9       │
 ├──────────────────────────────────────────────────┼─────────┤
 │ src/components/community/CommunityPostCard.tsx   │ 12      │
 └──────────────────────────────────────────────────┴─────────┘
 Note: Item 10 (ContextPanel nesting) was already addressed in the prior refactor — it now uses a flat Tabs layout.

 ---
 Verification

 1. Build: Run npm run build to confirm no TypeScript errors
 2. Mobile bottom bar: Confirm live preview strip, score badge, and Enhance button render correctly on < 768px
 3. Dark mode: Toggle theme on any page — verify it persists across navigation (theme provider)
 4. Output toolbar: Verify Copy is primary, Save dropdown works, More dropdown works
 5. Community feed: Verify 2-column grid at lg, featured first card, staggered entry, category scroll fade visible on mobile
 6. 404 page: Navigate to /nonexistent — verify Header, Card, and CTAs render
 7. Post detail mobile: Verify action buttons stack full-width on narrow screens
 8. Comments: Verify "Post comment" button is primary green, no hover lift on the comments container card
 9. Enhance first card: Verify it hides after first enhancement or when all sections are complete
 10. Preview panel gradient: In community feed, verify collapsed prompt preview fades smoothly without a visible dark band