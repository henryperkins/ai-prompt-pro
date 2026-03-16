import type { ReactNode } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cx } from "@/lib/utils/cx";
import { renderIconSlot, type IconSlot } from "@/lib/utils/icon-slot";

type ButtonGroupSize = "sm" | "md" | "lg";

const sizeStyles: Record<ButtonGroupSize, string> = {
  sm: "min-h-11 px-3 text-sm sm:min-h-8 sm:px-3 sm:text-xs",
  md: "min-h-11 px-3.5 text-sm sm:min-h-9 sm:px-3.5",
  lg: "min-h-12 px-4 text-sm sm:min-h-11 sm:px-4",
};

const iconStyles: Record<ButtonGroupSize, string> = {
  sm: "h-4 w-4",
  md: "h-4.5 w-4.5",
  lg: "h-5 w-5",
};

interface ButtonGroupProps extends Omit<ToggleGroupPrimitive.ToggleGroupSingleProps, "type"> {
  size?: ButtonGroupSize;
  className?: string;
}

interface ButtonGroupItemProps extends ToggleGroupPrimitive.ToggleGroupItemProps {
  size?: ButtonGroupSize;
  iconLeading?: IconSlot<{ className?: string }>;
  iconTrailing?: IconSlot<{ className?: string }>;
}

export const ButtonGroup = ({ className, children, size = "md", ...props }: ButtonGroupProps) => {
  return (
    <ToggleGroupPrimitive.Root
      {...props}
      type="single"
      className={cx("inline-flex items-center rounded-md border border-border bg-card p-1", className)}
      data-size={size}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
};

export const ButtonGroupItem = ({
  className,
  children,
  iconLeading: IconLeading,
  iconTrailing: IconTrailing,
  size = "md",
  ...props
}: ButtonGroupItemProps) => {
  return (
    <ToggleGroupPrimitive.Item
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=on]:bg-background data-[state=on]:text-foreground",
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {renderIconSlot(IconLeading, { className: iconStyles[size] })}
      {children}
      {renderIconSlot(IconTrailing, { className: iconStyles[size] })}
    </ToggleGroupPrimitive.Item>
  );
};
