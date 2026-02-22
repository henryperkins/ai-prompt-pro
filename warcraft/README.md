# PromptForge — Fantasy Forge Screen Templates (v1)

These are **drop-in React + Tailwind templates** for the first 3 themed surfaces you listed:

1) Landing **Hero + Navbar**
2) **Prompt Builder** panel + Sidebar (incl. a Quality Gauge)
3) **Template / Community Cards** with rarity-tier styling

The styling follows the **high-fantasy MMORPG / forged-metal** vibe (arcane teal glow + gilded trims + ember accents), using your tokens.

---

## 1) Quick install

### A) Put the art assets in your public folder
Copy these files from the design-system pack into your app’s public/static folder:

- `promptforge-background-1920x1080.png`
- `promptforge-rune-texture-tile-1024.png`
- your PromptForge wordmark logo (PNG/SVG)

Recommended path (examples assume this):
```
public/pf/
  promptforge-background-1920x1080.png
  promptforge-rune-texture-tile-1024.png
  promptforge-wordmark.png
```

### B) Add the CSS theme file
Copy `styles/promptforge-fantasy.css` into your project and import it globally:

- **Vite/React**: import in `main.tsx` or `index.tsx`
- **Next.js**: import in `app/globals.css` or `pages/_app.tsx`

### C) Tailwind config (optional but recommended)
If you want clean `text-pf-...` / `shadow-pf-...` utilities, merge the snippet in `styles/tailwind.theme.snippet.js`
into your Tailwind config.

If you already have the Tailwind extension from the pack, you can keep it — this snippet just improves
opacity handling via `rgb(var(--...)/<alpha-value>)`.

---

## 2) Use the templates

### Hero + Navbar
- `components/PFHeroNavbar.tsx`

### Prompt Builder Panel + Sidebar
- `components/PFBuilderLayout.tsx`
- `components/PFQualityGauge.tsx`

### Template / Community Cards
- `components/PFTemplateCard.tsx`

Example usage lives in `examples/`.

---

## 3) Notes

- The CSS intentionally keeps glows **subtle**. Use them for *hover/focus/active* and “rare” elements.
- Gold trim is “legendary” — don’t put it on every surface.
- For typography, load **Cinzel** (display) + **Inter** (body). The CSS uses:
  - `--pf-font-display`
  - `--pf-font-body`

---

If you paste your current `tailwind.config` + where global CSS is imported, I can give you an exact minimal diff.
