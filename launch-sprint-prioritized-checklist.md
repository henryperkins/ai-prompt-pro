# Launch Sprint Prioritized Checklist

## Sprint Goal
Ship a clear, consistent quality-first brand across product and launch surfaces so first-time users can immediately answer:
what this product does, why it is different, and what to do next.

## P0 - Launch Blockers (must complete before launch)

### 1. Messaging lock (single source of truth)
- [x] Freeze brand line and tagline.
- [x] Freeze hero headline, subhead, and primary CTA.
- [x] Freeze three messaging pillars and one proof point per pillar.
- [x] Publish final messaging pack and link it from `docs/`.
Owner: Brand + Marketing
Done when: one approved copy source exists and all launch surfaces use exact wording.

### 2. Product branding pass
- [x] Update key product headings and helper copy in:
  - `src/pages/Index.tsx`
  - `src/pages/Library.tsx`
  - `src/pages/Community.tsx`
  - `src/components/PageShell.tsx`
- [x] Normalize core terminology (quality, context, remix) in product UI.
- [x] Update critical empty/error/success copy to approved tone.
Owner: Product Design + Frontend
Done when: top user paths read consistently and no conflicting value statements remain.

### 3. Metadata, title, and social preview alignment
- [x] Update browser title and OG/Twitter tags in `index.html`.
- [x] Confirm app name usage is consistent in UI and metadata.
- [x] Replace/confirm favicon and brand icon assets in `public/`.
Owner: Marketing + Frontend
Done when: title, preview card, and product name are consistent everywhere.

### 4. Visual token lock
- [x] Finalize primary/secondary/accent tokens in `src/index.css`.
- [x] Finalize typography scale and heading hierarchy.
- [x] Verify button/input/focus states for accessibility and consistency.
Owner: Product Design
Done when: token baseline is approved and no launch surface uses ad hoc colors.

### 5. Cross-surface QA gate
- [x] Run launch QA checklist for product pages, metadata, and responsive layouts.
- [x] Validate mobile breakpoints at 320/375/390/428 widths.
- [x] Confirm no terminology drift between Builder, Library, Community, and marketing copy.
Owner: QA + Brand
Done when: no P0 brand or clarity issues remain.

## P1 - Launch Window (should ship in same cycle)

### 6. Launch assets pack
- [x] Refresh screenshots to match final messaging/tokens.
- [x] Prepare social cards, announcement thread, and email copy.
- [x] Update app listing short and long descriptions.
Owner: Marketing + Design
Done when: publishing-ready asset bundle is complete.

### 7. Measurement baseline
- [x] Standardize UTM conventions by channel.
- [x] Create launch dashboard for awareness, activation, and retention.
- [x] Define weekly reporting template and owner.
Owner: Growth
Done when: launch traffic and conversion can be tracked from day one.

### 8. Launch experiments
- [x] Configure hero copy A/B test.
- [x] Configure primary CTA text A/B test.
- [x] Define success thresholds and rollback criteria.
Owner: Growth + Marketing
Done when: experiments are live with documented decision rules.

## P2 - Post-launch hardening

### 9. Naming track
- [ ] Decide keep/evolve/rename direction.
- [ ] If evolving, shortlist options and run quick conflict checks.
- [ ] Document recommendation and risk summary.
Owner: Brand
Done when: naming direction is approved for the next release cycle.

### 10. Brand system operationalization
- [ ] Publish reusable brand kit assets (logos, templates, usage rules).
- [ ] Create internal brand usage page in `docs/`.
- [ ] Add review checklist to PR process for copy/visual consistency.
Owner: Design + Marketing
Done when: teams can ship brand-consistent changes without manual rework.

## Execution Cadence
- Daily standup: blockers, dependencies, launch readiness.
- Mid-sprint review: copy hierarchy and visual consistency.
- Freeze window: lock copy and tokens except critical fixes.

## Technical Verification Gate
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run test:mobile`
- [x] `npm run build`
- [x] `npm run check:prod`

## Go/No-Go Checklist
- [ ] Users can explain product value in one sentence.
- [ ] Product UI and launch messaging tell the same story.
- [ ] Core claims are backed by visible product proof.
- [ ] Metrics pipeline is live before campaign traffic starts.
