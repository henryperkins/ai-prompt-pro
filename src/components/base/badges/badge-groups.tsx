import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { renderIconSlot, type IconSlot } from "@/lib/utils/icon-slot";
import { Badge } from "./badges";
import type { BadgeTone } from "./badge-types";
import { ArrowRight } from "@phosphor-icons/react";

interface BadgeGroupProps {
  addonText: string;
  children?: ReactNode;
  tone?: BadgeTone;
  iconTrailing?: IconSlot<{ className?: string }>;
  className?: string;
}

export const BadgeGroup = ({
  addonText,
  children,
  tone = "default",
  iconTrailing: IconTrailing = ArrowRight,
  className,
}: BadgeGroupProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card px-1 py-1 text-xs font-medium text-foreground",
        className,
      )}
    >
      <Badge tone={tone} size="sm" className="border-transparent">
        {addonText}
      </Badge>
      {children ? <span className="pr-1">{children}</span> : null}
      {renderIconSlot(IconTrailing, { className: "mr-1 h-3.5 w-3.5 text-muted-foreground" })}
    </span>
  );
};
