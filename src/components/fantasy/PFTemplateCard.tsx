import { cx } from "@/lib/utils/cx";

export type PFRarity = "common" | "rare" | "epic" | "legendary";

export type PFTemplateCardProps = {
  title: string;
  description: string;
  rarity: PFRarity;
  author?: string;
  tags?: string[];
  footerLeft?: string;
  footerRight?: string;
  onClick?: () => void;
};

const rarityLabel: Record<PFRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const rarityClass: Record<PFRarity, string> = {
  common: "pf-rarity-common",
  rare: "pf-rarity-rare",
  epic: "pf-rarity-epic",
  legendary: "pf-rarity-legendary",
};

export function PFTemplateCard({
  title,
  description,
  rarity,
  author = "Community",
  tags = [],
  footerLeft = "Recently forged",
  footerRight = "Ready",
  onClick,
}: PFTemplateCardProps) {
  const CardTag = onClick ? "button" : "div";

  return (
    <CardTag
      onClick={onClick}
      className={cx("pf-card w-full p-5 text-left", rarityClass[rarity], onClick && "cursor-pointer")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-pf-parchment/65">{author}</div>
          <div className="mt-1 text-lg font-extrabold text-pf-parchment/95">{title}</div>
        </div>

        <span
          className={cx(
            "rounded-full border px-3 py-1 text-xs font-extrabold",
            rarity === "legendary"
              ? "border-pf-gold/65 bg-pf-gold/10 text-pf-gold/95"
              : rarity === "epic"
                ? "border-pf-ember/55 bg-pf-ember/10 text-pf-ember/90"
                : rarity === "rare"
                  ? "border-pf-arcane/55 bg-pf-arcane/10 text-pf-arcane"
                  : "border-pf-parchment/15 bg-pf-parchment/5 text-pf-parchment/80",
          )}
        >
          {rarityLabel[rarity]}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-pf-parchment/75">
        {description}
      </p>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-pf-parchment/10 bg-pf-coal/25 px-3 py-1 text-xs font-semibold text-pf-parchment/70"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 pf-divider" />

      <div className="mt-3 flex items-center justify-between text-xs text-pf-parchment/60">
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </CardTag>
  );
}
