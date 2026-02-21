import type { FC, ReactNode } from "react";
import { isValidElement } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";
import { isReactComponent } from "@/utils/is-react-component";

type ButtonGroupSize = "sm" | "md" | "lg";

const sizeStyles: Record<ButtonGroupSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-4 text-sm",
};

const iconStyles: Record<ButtonGroupSize, string> = {
  sm: "h-4 w-4",
  md: "h-4.5 w-4.5",
  lg: "h-5 w-5",
};

interface ButtonGroupProps extends ToggleGroupPrimitive.ToggleGroupSingleProps {
  size?: ButtonGroupSize;
  className?: string;
}

interface ButtonGroupItemProps extends ToggleGroupPrimitive.ToggleGroupItemProps {
  size?: ButtonGroupSize;
  iconLeading?: FC<{ className?: string }> | ReactNode;
  iconTrailing?: FC<{ className?: string }> | ReactNode;
}

export const ButtonGroup = ({ className, children, size = "md", ...props }: ButtonGroupProps) => {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      className={cn("inline-flex items-center rounded-md border border-border bg-card p-1", className)}
      data-size={size}
      {...props}
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
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=on]:bg-background data-[state=on]:text-foreground",
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {isReactComponent(IconLeading) && <IconLeading className={iconStyles[size]} />}
      {isValidElement(IconLeading) && IconLeading}
      {children}
      {isReactComponent(IconTrailing) && <IconTrailing className={iconStyles[size]} />}
      {isValidElement(IconTrailing) && IconTrailing}
    </ToggleGroupPrimitive.Item>
  );
};
