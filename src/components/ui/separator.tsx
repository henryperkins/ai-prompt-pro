import * as React from "react";

import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
  }
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <div
    ref={ref}
    role={decorative ? "presentation" : "separator"}
    aria-orientation={orientation}
    className={cn(
      "shrink-0 border-secondary",
      orientation === "horizontal" ? "w-full border-t" : "h-full border-l",
      className,
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

export { Separator };
