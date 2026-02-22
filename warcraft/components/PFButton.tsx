import * as React from "react";
import { cx } from "../utils/cx";

export type PFButtonVariant = "primary" | "secondary" | "ghost";

export type PFButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PFButtonVariant;
};

export function PFButton({ variant = "primary", className, ...props }: PFButtonProps) {
  const v =
    variant === "primary"
      ? "pf-button-primary"
      : variant === "secondary"
      ? "pf-button-secondary"
      : "pf-button-ghost";

  return (
    <button
      {...props}
      className={cx("pf-button", v, className)}
    />
  );
}
