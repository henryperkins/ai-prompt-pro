import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition duration-100 ease-linear focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-utility-brand-200 bg-utility-brand-50 text-utility-brand-700",
        secondary: "border-primary bg-primary text-secondary shadow-xs",
        destructive: "border-utility-error-200 bg-utility-error-50 text-utility-error-700",
        outline: "border-secondary bg-primary text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
