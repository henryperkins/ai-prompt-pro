import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BadgeSize, BadgeTone } from "./badge-types";

const toneStyles: Record<BadgeTone, string> = {
  default: "border-border bg-muted text-foreground",
  info: "border-blue-300/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success: "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "border-red-300/50 bg-red-500/10 text-red-700 dark:text-red-300",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "h-5 px-2 text-[11px]",
  md: "h-6 px-2.5 text-xs",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  children: ReactNode;
}

interface BadgeWithDotProps extends BadgeProps {
  dotClassName?: string;
}

export const Badge = ({ tone = "default", size = "md", className, children, ...props }: BadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        toneStyles[tone],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export const BadgeWithDot = ({ tone = "default", size = "md", dotClassName, className, children, ...props }: BadgeWithDotProps) => {
  return (
    <Badge tone={tone} size={size} className={cn("gap-1.5", className)} {...props}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", dotClassName)} aria-hidden="true" />
      {children}
    </Badge>
  );
};
