import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

let hasWarnedDeprecatedPrimitiveBadge = false;

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition duration-100 ease-linear focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-primary",
        secondary: "border-secondary bg-secondary text-secondary-foreground shadow-xs",
        destructive: "border-destructive/35 bg-destructive/10 text-destructive",
        outline: "border-border bg-background text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  if (import.meta.env.DEV && import.meta.env.MODE !== "test" && !hasWarnedDeprecatedPrimitiveBadge) {
    hasWarnedDeprecatedPrimitiveBadge = true;
    console.warn(
      "[design-system] `@/components/base/primitives/badge` is deprecated. Use `@/components/base/badges/badges`.",
    );
  }

  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
