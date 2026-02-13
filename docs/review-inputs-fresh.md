1. App purpose + target users  
`PromptForge` is a React/Vite app for turning rough prompts into structured, reusable prompts with AI enhancement, private library/history, and community remix flows.  
Target users are developers and technical AI users who want repeatable, production-quality prompt workflows.

2. Top 3 user flows (steps + success)  
1. Builder enhance flow  
Steps: `/` → enter base prompt + builder/context/tone inputs → click `Enhance with AI` → copy/save/share output.  
Success: enhanced prompt appears in Preview and user can copy/save/share without errors.

2. Library load/manage flow  
Steps: `/library` → search/filter saved prompts → load/share/unshare/delete (or open bulk edit).  
Success: selected prompt is restored into Builder, or selected library action completes with clear feedback.

3. Community discovery/remix flow  
Steps: `/community` → search/sort/filter → open `/community/:postId` → copy/remix/save.  
Success: user can discover relevant prompts and complete copy/remix/save actions from feed/detail screens.

3. Routes/screens to review (route + one-line purpose)  
- `/` — primary builder and enhancement workspace.  
- `/presets` — starter templates that prefill builder inputs.  
- `/community` — community discovery feed (search/sort/filter/copy/remix entry).  
- `/community/:postId` — single post detail with actions and state handling.  
- `/library` — saved prompts management (search/filter/share/load/delete).  
- `/library/bulk-edit` — batch operations for selected saved prompts.  
- `/history` — saved version restore flow back to Builder.  
- `*` — not-found fallback with recovery links.

4. Fresh screenshots (regenerated today: February 13, 2026)  
Mobile `390x844`  
- `/`: `screenshots/mobile/home.png`  
- `/community`: `screenshots/mobile/community.png`  
- `/community/:postId`: `screenshots/mobile/community-post-detail.png`  
- `/library`: `screenshots/mobile/library.png`  
- `/history`: `screenshots/mobile/history.png`  
- `*`: `screenshots/mobile/notfound.png`

Desktop `1440x900`  
- `/`: `screenshots/desktop/home.png`  
- `/community`: `screenshots/desktop/community.png`  
- `/community/:postId`: `screenshots/desktop/community-post-detail.png`  
- `/library`: `screenshots/desktop/library.png`  
- `/history`: `screenshots/desktop/history.png`  
- `*`: `screenshots/desktop/notfound.png`

State examples included  
- Error state: `screenshots/mobile/community.png` (`Couldn’t load community feed`)  
- Error state: `screenshots/desktop/community-post-detail.png` (`This post is unavailable`)  
- Empty state: `screenshots/desktop/library.png` (`No saved prompts yet`)  
- Empty state: `screenshots/mobile/history.png` (`No saved versions yet`)

5. Design constraints (brand/typography/system)  
- Design system is token-first CSS variables in `src/index.css:10` with Tailwind mapping in `tailwind.config.ts:16`.  
- Primary brand accent is green (`--primary: 161 93% 30%`) in `src/index.css:20`.  
- Typography uses system font stacks (`--font-sans`, `--font-serif`, `--font-mono`) in `src/index.css:69`.  
- Component stack: Radix/shadcn UI primitives + Tailwind (from `package.json` dependencies).  
- Mobile-first control sizing and accessibility conventions are documented in `docs/design-system.md`.

6. Known pain points / metrics  
- Known pain point: community surfaces can land in auth/network error states for signed-out users; see `src/pages/Community.tsx:139` and `src/pages/CommunityPost.tsx:120`.  
- Known pain point: app hard-fails at startup if Neon env vars are missing (`src/integrations/neon/client.ts:26`).  
- Metrics: no bounce/drop-off/conversion telemetry summary found in-repo.

Optional helpful items  
- Lighthouse/Web Vitals summary: not captured in this pass.  
- Relevant snippets to inspect first: `src/integrations/neon/client.ts:26`, `src/pages/Community.tsx:105`, `src/pages/Community.tsx:153`, `src/index.css:20`.
