import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Question as HelpCircle } from "@phosphor-icons/react";
import { Label as PrimitiveLabel } from "@/components/base/primitives/label";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip";
import { cx } from "@/lib/utils/cx";

export interface LabelProps extends ComponentPropsWithoutRef<typeof PrimitiveLabel> {
  children: ReactNode;
  isRequired?: boolean;
  tooltip?: string;
  tooltipDescription?: string;
}

export const Label = ({ children, className, isRequired, tooltip, tooltipDescription, ...props }: LabelProps) => {
  return (
    <PrimitiveLabel
      // Used for conditionally hiding/showing the label element via CSS selectors.
      data-label="true"
      {...props}
      className={cx(
        "inline-flex items-center gap-0.5 text-foreground",
        className,
      )}
    >
      {children}

      {isRequired ? (
        <span aria-hidden="true" className="text-brand-tertiary">
          *
        </span>
      ) : null}

      {tooltip && (
        <Tooltip title={tooltip} description={tooltipDescription} placement="top">
          <TooltipTrigger
            // Keep tooltip enabled even when parent field is disabled.
            isDisabled={false}
            className="cursor-pointer text-fg-quaternary transition duration-200 hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover"
          >
            <HelpCircle className="size-4" />
          </TooltipTrigger>
        </Tooltip>
      )}
    </PrimitiveLabel>
  );
};

Label.displayName = "Label";
