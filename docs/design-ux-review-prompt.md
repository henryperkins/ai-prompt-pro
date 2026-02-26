# PromptForge Design and UX Review Prompt

Last updated: 2026-02-26

```text
You are a principal product designer + senior UX auditor. Review the app’s design system quality, visual consistency, and end-to-end UX using ONLY the assets and docs below.

Goal:
Deliver an evidence-based UX/design review that is actionable for engineering and product.

Project context:
- Product: PromptForge (prompt builder, library/history, community remix)
- Primary users: developers and technical AI users
- Design system reference: docs/design-system.md
- Route/flow context: docs/ux-review-prioritized.md
- Launch asset references: docs/launch-assets-pack.md

Assets to review:
- Mobile (390x844):
  - screenshots/mobile/home.png
  - screenshots/mobile/community.png
  - screenshots/mobile/community-post-detail.png
  - screenshots/mobile/library.png
  - screenshots/mobile/history.png
  - screenshots/mobile/notfound.png
- Desktop (1440x900):
  - screenshots/desktop/home.png
  - screenshots/desktop/community.png
  - screenshots/desktop/community-post-detail.png
  - screenshots/desktop/library.png
  - screenshots/desktop/history.png
  - screenshots/desktop/notfound.png
- Launch screenshots:
  - screenshots/launch-sprint/builder-desktop.png
  - screenshots/launch-sprint/library-desktop.png
  - screenshots/launch-sprint/builder-mobile-390.png
  - screenshots/launch-sprint/community-mobile-390.png
- Additional:
  - screenshots/desktop-home.png

Required evaluation dimensions:
1. Visual hierarchy and readability
2. Navigation clarity and information architecture
3. Input/form usability (focus heavily here)
4. Mobile ergonomics (touch targets, spacing, keyboard/focus risks)
5. Consistency with the design system/tokens
6. Accessibility risks visible from UI (contrast, affordance, state clarity)
7. Empty/error/not-found state quality
8. Cross-screen and cross-device consistency
9. Conversion/activation friction in key flows
10. Overall brand coherence (logo/gradient/border usage)

Output format (strict):
1. Executive Summary (5-8 bullets)
2. Findings (ordered by severity: Critical, High, Medium, Low)
   - For each finding include:
     - Title
     - Evidence (exact screenshot/doc path)
     - Why it matters (user impact + business impact)
     - Recommendation (specific UI/UX change)
     - Effort (S/M/L)
3. Flow Audit
   - Builder enhance flow
   - Library manage flow
   - Community discovery/remix flow
   - For each: friction points, drop-off risks, quick wins
4. Input-Area Deep Dive
   - Evaluate clarity, affordance, visual prominence, state feedback, consistency, mobile comfort
   - Call out where branded input treatments help/hurt usability
5. Prioritized Action Plan
   - P0 (this sprint), P1 (next sprint), P2 (later)
   - Include success metric for each item
6. Scorecard (0-10 each)
   - Visual design
   - UX clarity
   - Accessibility readiness
   - Mobile quality
   - Design-system consistency
   - Overall product polish

Review constraints:
- Do not invent evidence. If uncertain, say “Not verifiable from provided assets.”
- Prefer concrete recommendations over generic advice.
- Keep the review implementation-aware so engineers can act on it immediately.
- Be candid and critical; avoid praise unless supported by clear evidence.
```
