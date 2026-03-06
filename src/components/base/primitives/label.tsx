import * as React from "react";

import { cx } from "@/lib/utils/cx";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cx("text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 sm:text-base", className)}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
