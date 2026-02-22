// Tailwind theme extension for PromptForge (Fantasy Forge)
module.exports = {
  theme: {
    extend: {
      colors: {
        pf: {
          arcane: "#12C8B5",
          deep: "#0A6A64",
          gold: "#D6A640",
          antique: "#B8872B",
          ember: "#FF7A18",
          coal: "#0B0F14",
          midnight: "#1D2630",
          slate: "#2E3A46",
          parchment: "#E6E1D5",
          ash: "#B7B0A5",
        },
      },
      borderRadius: {
        "pf-sm": "12px",
        "pf-md": "18px",
        "pf-lg": "26px",
        "pf-xl": "32px",
      },
      boxShadow: {
        "pf-card": "0 18px 40px rgba(0,0,0,0.45)",
        "pf-elevated": "0 26px 70px rgba(0,0,0,0.55)",
        "pf-glow": "0 0 24px rgba(18,200,181,0.28)",
        "pf-ember": "0 0 28px rgba(255,122,24,0.22)",
      },
    },
  },
};
