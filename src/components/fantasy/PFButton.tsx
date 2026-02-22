import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/utils/cx";

export type PFButtonVariant = "primary" | "secondary" | "ghost";

export type PFButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PFButtonVariant;
};

export function PFButton({ variant = "primary", className, ...props }: PFButtonProps) {
  const variantClass =
    variant === "primary"
      ? "pf-button-primary"
      : variant === "secondary"
        ? "pf-button-secondary"
        : "pf-button-ghost";

  return <button {...props} className={cx("pf-button", variantClass, className)} />;
}
