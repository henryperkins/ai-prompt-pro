1. App purpose + target users  
`AI Prompt Pro` / `PromptForge` is a prompt-building app that turns rough prompts into structured, high-quality instructions, with save/history and community sharing/remix features.  
Primary users are developers and technical AI users who need repeatable, production-quality prompts.

2. Top 3 user flows (start → key steps → success)  
1. Builder enhancement flow: `/` → enter base prompt, fill builder/context/tone sections, click `Enhance with AI` → optimized prompt appears in Preview and can be copied/saved/shared.  
2. Library load/manage flow: `/library` → pick starter template or saved prompt, optionally share/unshare/delete saved item → prompt is loaded back into `/` (or sharing state is updated).  
3. Community discovery/remix flow: `/community` → search/sort/filter posts, open `/community/:postId`, copy or save/remix → prompt is copied or stored for reuse/remix.

3. Route list with one-line description  
- `/` — Main prompt builder and AI enhancement workspace.  
- `/community` — Community feed with search, sort, category filters, voting, and post entry points.  
- `/community/:postId` — Single community post detail with copy, vote, comments, and remix/save actions.  
- `/library` — Starter templates + saved prompt management and load/share actions.  
- `/history` — Version history list with restore-to-builder action.  
- `*` — 404 fallback screen with links back to Builder/Community.

4. Screenshots of key routes

Desktop (full layout)  
- Home: `screenshots/desktop/home.png`  
- Community: `screenshots/desktop/community.png`  
- Community post detail: `screenshots/desktop/community-post-detail.png`  
- Library: `screenshots/desktop/library.png`  
- History: `screenshots/desktop/history.png`  
- Not found: `screenshots/desktop/notfound.png`

Mobile (390px width)  
- Home: `screenshots/mobile/home.png`  
- Community: `screenshots/mobile/community.png`  
- Community post detail: `screenshots/mobile/community-post-detail.png`  
- Library: `screenshots/mobile/library.png`  
- History: `screenshots/mobile/history.png`  
- Not found: `screenshots/mobile/notfound.png`

Optional high-value notes (current environment)  
- Known pain point observed: community feed currently shows `0 posts`, so detail screenshots show unavailable/error-state behavior.  
- Metrics (bounce/conversion/drop-off): not available from repo alone.  
- Brand/design constraints: none explicitly documented beyond current shadcn/Tailwind implementation.  
- Lighthouse/Web Vitals: not captured in this pass.
