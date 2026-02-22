import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isInvalid?: boolean;
  isDisabled?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, isInvalid, isDisabled, disabled, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const invalid = isInvalid || ariaInvalid === true || ariaInvalid === "true";
    const disabledState = disabled || isDisabled;

    return (
      <textarea
        disabled={disabledState}
        aria-invalid={invalid ? "true" : ariaInvalid}
        className={cn(
          "min-h-[96px] w-full rounded-md bg-background px-3 py-2 text-base text-foreground shadow-xs ring-1 ring-border ring-inset transition duration-100 ease-linear placeholder:text-muted-foreground autofill:rounded-md autofill:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-disabled_subtle disabled:text-disabled disabled:ring-disabled sm:min-h-[88px]",
          invalid && "ring-error_subtle focus-visible:ring-error",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
