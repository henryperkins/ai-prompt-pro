import * as React from "react";

import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  isInvalid?: boolean;
  isDisabled?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, isInvalid, isDisabled, disabled, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const invalid = isInvalid || ariaInvalid === true || ariaInvalid === "true";
    const disabledState = disabled || isDisabled;

    return (
      <input
        type={type}
        disabled={disabledState}
        aria-invalid={invalid ? "true" : ariaInvalid}
        className={cn(
          "h-11 w-full rounded-md bg-primary px-3 py-2 text-base text-primary shadow-xs ring-1 ring-primary ring-inset transition duration-100 ease-linear placeholder:text-placeholder autofill:rounded-md autofill:text-primary file:border-0 file:bg-transparent file:text-base file:font-medium file:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:bg-disabled_subtle disabled:text-disabled disabled:ring-disabled sm:h-10",
          invalid && "ring-error_subtle focus-visible:ring-error",
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
