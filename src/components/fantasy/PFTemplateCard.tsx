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
          <div className="text-xs text-[rgba(230,225,213,.65)]">{author}</div>
          <div className="mt-1 text-lg font-extrabold text-[rgba(230,225,213,.96)]">{title}</div>
        </div>

        <span
          className={cx(
            "rounded-full border px-3 py-1 text-xs font-extrabold",
            rarity === "legendary"
              ? "border-[rgba(214,166,64,.65)] bg-[rgba(214,166,64,.08)] text-[rgba(214,166,64,.95)]"
              : rarity === "epic"
                ? "border-[rgba(255,122,24,.55)] bg-[rgba(255,122,24,.08)] text-[rgba(255,170,120,.95)]"
                : rarity === "rare"
                  ? "border-[rgba(18,200,181,.55)] bg-[rgba(18,200,181,.08)] text-[rgba(160,255,242,.95)]"
                  : "border-white/15 bg-white/5 text-[rgba(230,225,213,.78)]",
          )}
        >
          {rarityLabel[rarity]}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[rgba(230,225,213,.75)]">
        {description}
      </p>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-semibold text-[rgba(230,225,213,.70)]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 pf-divider" />

      <div className="mt-3 flex items-center justify-between text-xs text-[rgba(230,225,213,.6)]">
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </CardTag>
  );
}
