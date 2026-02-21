import type { FC, ReactNode } from "react";
import { isValidElement } from "react";
import { ArrowRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { isReactComponent } from "@/utils/is-react-component";
import { Badge } from "./badges";
import type { BadgeTone } from "./badge-types";

interface BadgeGroupProps {
  addonText: string;
  children?: ReactNode;
  tone?: BadgeTone;
  iconTrailing?: FC<{ className?: string }> | ReactNode;
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
      {isReactComponent(IconTrailing) && <IconTrailing className="mr-1 h-3.5 w-3.5 text-muted-foreground" />}
      {isValidElement(IconTrailing) && IconTrailing}
    </span>
  );
};
