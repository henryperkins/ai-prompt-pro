import { cx } from "@/lib/utils/cx";

export type PFNavLink = { label: string; href: string };

export type PFHeroNavbarProps = {
  logoSrc?: string;
  heroBgSrc?: string;
  runeTileSrc?: string;
  links?: PFNavLink[];
  primaryCta?: PFNavLink;
  secondaryCta?: PFNavLink;
  headline?: string;
  subhead?: string;
};

export function PFHeroNavbar({
  logoSrc = "/brand/pf-logo-wordmark-horizontal-v3-tight.png",
  heroBgSrc = "/pf/promptforge-background-1920x1080.png",
  runeTileSrc = "/pf/promptforge-rune-texture-tile-1024.png",
  links = [
    { label: "Artifacts", href: "#artifacts" },
    { label: "Templates", href: "#templates" },
    { label: "Community", href: "#community" },
    { label: "Docs", href: "#docs" },
  ],
  primaryCta = { label: "Enter the Forge", href: "#start" },
  secondaryCta = { label: "Browse Templates", href: "#templates" },
  headline = "Forge the Prompt",
  subhead = "Craft, refine, and share prompt artifacts — powered by arcane glow and forged-metal polish.",
}: PFHeroNavbarProps) {
  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroBgSrc})` }} />
        <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/40 to-black/70" />
        <div className="absolute inset-0 mask-[radial-gradient(60%_60%_at_50%_35%,black,transparent)] bg-black/55" />
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay"
          style={{ backgroundImage: `url(${runeTileSrc})`, backgroundSize: "640px 640px" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-6">
        <nav className="flex items-center justify-between gap-6">
          <a href="#" className="flex items-center gap-3">
            <img src={logoSrc} alt="PromptForge" className="h-9 w-auto" />
          </a>

          <div className="hidden items-center gap-7 md:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="pf-nav-link text-sm font-semibold">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a href={secondaryCta.href} className={cx("pf-button pf-button-ghost", "h-10 px-4 text-sm")}>
              {secondaryCta.label}
            </a>
            <a href={primaryCta.href} className={cx("pf-button pf-button-primary", "h-10 px-4 text-sm")}>
              {primaryCta.label}
            </a>
          </div>
        </nav>

        <section className="mt-12 md:mt-16">
          <div className="pf-gilded-frame p-7 md:p-10">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(214,166,64,.45)] bg-black/30 px-3 py-1 text-xs font-semibold text-[rgba(230,225,213,.85)]">
                <span className="h-2 w-2 rounded-full bg-[rgb(var(--pf-arcane-rgb))] shadow-[0_0_18px_rgba(18,200,181,.35)]" />
                New: community artifacts + rarity tiers
              </div>

              <h1 className="pf-text-display mt-5 text-4xl leading-[1.02] md:text-6xl">{headline}</h1>

              <p className="mt-4 text-base text-[rgba(230,225,213,.82)] md:text-lg">{subhead}</p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href={primaryCta.href} className={cx("pf-button pf-button-primary", "h-12 px-6")}>
                  {primaryCta.label}
                </a>
                <a href={secondaryCta.href} className={cx("pf-button pf-button-secondary", "h-12 px-6")}>
                  {secondaryCta.label}
                </a>
              </div>

              <div className="mt-8 pf-divider" />

              <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <HeroStat label="Forge time" value="~30s" hint="from draft to artifact" />
                <HeroStat label="Quality tiers" value="Common → Legendary" hint="rarity frames included" />
                <HeroStat label="Modes" value="Arcane / Ember" hint="focus vs destructive actions" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </header>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="text-xs text-[rgba(230,225,213,.68)]">{label}</div>
      <div className="mt-1 font-bold text-[rgba(230,225,213,.95)]">{value}</div>
      <div className="mt-1 text-xs text-[rgba(230,225,213,.62)]">{hint}</div>
    </div>
  );
}
