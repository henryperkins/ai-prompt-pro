import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

let hasWarnedDeprecatedPrimitiveButton = false;

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:text-sm [&_svg]:pointer-events-none [&_svg]:h-[1em] [&_svg]:w-[1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:brightness-95",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:brightness-95",
        brandPrimary:
          "border border-primary/30 text-primary-foreground bg-[linear-gradient(135deg,hsl(var(--delight-warm)),hsl(var(--delight-cool)))] shadow-[0_14px_30px_-20px_hsl(var(--delight-glow)/0.72)] hover:brightness-105",
        brandSecondary:
          "border border-secondary bg-primary text-secondary shadow-xs hover:brightness-95",
        brandDestructive:
          "border border-destructive/30 text-destructive-foreground bg-[linear-gradient(135deg,hsl(var(--destructive)),hsl(0_70%_42%))] shadow-[0_12px_24px_-18px_hsl(var(--destructive)/0.8)] hover:brightness-105",
        outline: "border border-secondary bg-primary text-secondary shadow-xs hover:brightness-95",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:brightness-95",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "justify-start rounded p-0 text-primary underline-offset-4 hover:text-primary/90 hover:underline",
        glow:
          "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:brightness-95 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)] motion-safe:hover:-translate-y-[1px] motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]",
        soft: "border border-primary/20 bg-secondary text-secondary-foreground hover:brightness-95",
      },
      size: {
        default: "h-11 px-4 py-2 sm:h-10",
        sm: "h-11 rounded-md px-3 sm:h-9",
        lg: "h-12 rounded-md px-8 sm:h-11",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  showTextWhileLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, showTextWhileLoading = false, children, disabled, ...props }, ref) => {
    if (import.meta.env.DEV && import.meta.env.MODE !== "test" && !hasWarnedDeprecatedPrimitiveButton) {
      hasWarnedDeprecatedPrimitiveButton = true;
      console.warn(
        "[design-system] `@/components/base/primitives/button` is deprecated. Use `@/components/base/buttons/button`.",
      );
    }

    if (asChild) {
      return (
        <Slot
          data-loading={isLoading ? true : undefined}
          className={cn(
            buttonVariants({ variant, size }),
            isLoading && "pointer-events-none",
            className,
          )}
          ref={ref}
          aria-disabled={disabled || isLoading ? true : undefined}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        data-loading={isLoading ? true : undefined}
        className={cn(
          buttonVariants({ variant, size }),
          isLoading && "pointer-events-none",
          isLoading && !showTextWhileLoading && "[&>*:not([data-icon=loading])]:invisible",
          className,
        )}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            fill="none"
            data-icon="loading"
            viewBox="0 0 20 20"
            className={cn("size-5", !showTextWhileLoading && "absolute")}
          >
            <circle className="stroke-current opacity-30" cx="10" cy="10" r="8" fill="none" strokeWidth="2" />
            <circle
              className="origin-center animate-spin stroke-current"
              cx="10"
              cy="10"
              r="8"
              fill="none"
              strokeWidth="2"
              strokeDasharray="12.5 50"
              strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
