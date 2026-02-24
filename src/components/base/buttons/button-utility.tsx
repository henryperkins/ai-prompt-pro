import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/base/primitives/tooltip";
import { cn } from "@/lib/utils";
import { renderIconSlot, type IconSlot } from "@/lib/utils/icon-slot";

type UtilityButtonColor = "secondary" | "tertiary";
type UtilityButtonSize = "xs" | "sm";

interface CommonProps {
  isDisabled?: boolean;
  size?: UtilityButtonSize;
  color?: UtilityButtonColor;
  icon?: IconSlot<{ className?: string }>;
  tooltip?: string;
  tooltipPlacement?: "top" | "right" | "bottom" | "left";
}

interface UtilityButtonAsButton extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  href?: never;
}

interface UtilityButtonAsLink extends CommonProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "color"> {
  href: string;
}

export type ButtonUtilityProps = UtilityButtonAsButton | UtilityButtonAsLink;

const colorStyles: Record<UtilityButtonColor, string> = {
  secondary: "border border-border bg-card text-foreground shadow-sm hover:bg-muted",
  tertiary: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

const sizeStyles: Record<UtilityButtonSize, string> = {
  xs: "h-8 w-8",
  sm: "h-9 w-9",
};

const iconStyles: Record<UtilityButtonSize, string> = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
};

export const ButtonUtility = ({
  icon: Icon,
  size = "sm",
  color = "secondary",
  tooltip,
  tooltipPlacement = "top",
  isDisabled,
  className,
  ...props
}: ButtonUtilityProps) => {
  const content = renderIconSlot(Icon, { className: iconStyles[size] });

  const sharedClassName = cn(
    "inline-flex items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    sizeStyles[size],
    colorStyles[color],
    className,
  );

  const element =
    "href" in props && props.href ? (
      <a
        {...props}
        aria-disabled={isDisabled}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault();
          }
          props.onClick?.(event);
        }}
        className={sharedClassName}
      >
        {content}
      </a>
    ) : (
      <button
        {...props}
        type={props.type ?? "button"}
        disabled={isDisabled}
        className={sharedClassName}
      >
        {content}
      </button>
    );

  if (!tooltip) {
    return element;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{element}</TooltipTrigger>
        <TooltipContent side={tooltipPlacement}>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
