import * as React from "react";
import { cx } from "../utils/cx";

export type PFRarity = "common" | "rare" | "epic" | "legendary";

export type PFTemplateCardProps = {
  title: string;
  description: string;
  rarity: PFRarity;
  author?: string;
  tags?: string[];
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
  onClick,
}: PFTemplateCardProps) {
  const CardTag = onClick ? "button" : "div";

  return (
    <CardTag
      onClick={onClick}
      className={cx(
        "pf-card text-left p-5 w-full",
        rarityClass[rarity],
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[rgba(230,225,213,.65)]">{author}</div>
          <div className="mt-1 text-lg font-extrabold">{title}</div>
        </div>

        <span className={cx("rounded-full px-3 py-1 text-xs font-extrabold border",
          rarity === "legendary"
            ? "border-[rgba(214,166,64,.65)] text-[rgba(214,166,64,.95)] bg-[rgba(214,166,64,.08)]"
            : rarity === "epic"
            ? "border-[rgba(255,122,24,.55)] text-[rgba(255,170,120,.95)] bg-[rgba(255,122,24,.08)]"
            : rarity === "rare"
            ? "border-[rgba(18,200,181,.55)] text-[rgba(160,255,242,.95)] bg-[rgba(18,200,181,.08)]"
            : "border-white/15 text-[rgba(230,225,213,.78)] bg-white/5"
        )}>
          {rarityLabel[rarity]}
        </span>
      </div>

      <p className="mt-3 text-sm text-[rgba(230,225,213,.75)] leading-relaxed">
        {description}
      </p>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-[999px] border border-white/10 bg-black/25 px-3 py-1 text-xs font-semibold text-[rgba(230,225,213,.70)]"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 pf-divider" />

      <div className="mt-3 flex items-center justify-between text-xs text-[rgba(230,225,213,.60)]">
        <span>Last forged: 2d ago</span>
        <span>★ 4.7</span>
      </div>
    </CardTag>
  );
}
