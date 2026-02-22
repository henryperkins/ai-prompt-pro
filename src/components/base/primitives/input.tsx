import * as React from "react";

import { cn } from "@/lib/utils";

let hasWarnedDeprecatedPrimitiveInput = false;

interface InputProps extends React.ComponentProps<"input"> {
  isInvalid?: boolean;
  isDisabled?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, isInvalid, isDisabled, disabled, "aria-invalid": ariaInvalid, ...props }, ref) => {
    if (import.meta.env.DEV && import.meta.env.MODE !== "test" && !hasWarnedDeprecatedPrimitiveInput) {
      hasWarnedDeprecatedPrimitiveInput = true;
      console.warn(
        "[design-system] `@/components/base/primitives/input` is deprecated. Use `@/components/base/input/input`.",
      );
    }

    const invalid = isInvalid || ariaInvalid === true || ariaInvalid === "true";
    const disabledState = disabled || isDisabled;

    return (
      <input
        type={type}
        disabled={disabledState}
        aria-invalid={invalid ? "true" : ariaInvalid}
        className={cn(
          "h-11 w-full rounded-md bg-background px-3 py-2 text-base text-foreground shadow-xs ring-1 ring-border ring-inset transition duration-100 ease-linear placeholder:text-muted-foreground autofill:rounded-md autofill:text-foreground file:border-0 file:bg-transparent file:text-base file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:ring-border sm:h-10",
          invalid && "ring-destructive/35 focus-visible:ring-destructive",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
