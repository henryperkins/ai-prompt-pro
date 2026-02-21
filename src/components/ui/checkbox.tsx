import * as React from "react";

import { CheckboxBase } from "@/components/base/checkbox/checkbox";
import { cn } from "@/lib/utils";

type CheckedState = boolean | "indeterminate";

type CheckboxProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
};

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, defaultChecked, onCheckedChange, className, disabled, onClick, type, ...props }, ref) => {
    const isControlled = typeof checked !== "undefined";
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState<CheckedState>(defaultChecked ?? false);

    const resolvedChecked = isControlled ? checked : uncontrolledChecked;
    const isIndeterminate = resolvedChecked === "indeterminate";
    const isSelected = resolvedChecked === true;
    const ariaChecked = isIndeterminate ? "mixed" : isSelected ? "true" : "false";
    const dataState = isIndeterminate ? "indeterminate" : isSelected ? "checked" : "unchecked";

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        role="checkbox"
        {...props}
        disabled={disabled}
        data-state={dataState}
        aria-checked={ariaChecked}
        className={cn("inline-flex items-center justify-center rounded-sm", className)}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || disabled) {
            return;
          }
          const nextChecked = isIndeterminate ? true : !isSelected;
          if (!isControlled) {
            setUncontrolledChecked(nextChecked);
          }
          onCheckedChange?.(nextChecked);
        }}
      >
        <CheckboxBase
          isSelected={isSelected}
          isIndeterminate={isIndeterminate}
          isDisabled={disabled}
          className="mt-0"
        />
      </button>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
