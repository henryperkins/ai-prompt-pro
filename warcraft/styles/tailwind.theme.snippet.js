// Tailwind theme snippet for PromptForge Fantasy Forge
// Purpose: enable opacity-aware utilities using rgb(var(--...)/<alpha-value>)

const withOpacity = (cssVar) => `rgb(var(${cssVar}) / <alpha-value>)`;

module.exports = {
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--pf-font-display)"],
        body: ["var(--pf-font-body)"],
      },
      colors: {
        pf: {
          arcane: withOpacity("--pf-arcane-rgb"),
          deep: withOpacity("--pf-deep-rgb"),
          gold: withOpacity("--pf-gold-rgb"),
          ember: withOpacity("--pf-ember-rgb"),
          coal: withOpacity("--pf-coal-rgb"),
          midnight: withOpacity("--pf-midnight-rgb"),
          slate: withOpacity("--pf-slate-rgb"),
          parchment: withOpacity("--pf-parchment-rgb"),
        },
      },
      boxShadow: {
        "pf-card": "0 18px 40px rgba(0,0,0,0.45)",
        "pf-elevated": "0 26px 70px rgba(0,0,0,0.55)",
        "pf-glow": "0 0 24px rgba(18,200,181,0.28)",
        "pf-ember": "0 0 28px rgba(255,122,24,0.22)",
        "pf-gold": "0 0 28px rgba(214,166,64,0.18)",
      },
      borderRadius: {
        "pf-sm": "12px",
        "pf-md": "18px",
        "pf-lg": "26px",
        "pf-xl": "32px",
      },
    },
  },
};
