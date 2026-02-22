import * as React from "react";
import { cx } from "../utils/cx";

export type PFPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Optional: add the gilded premium frame look */
  gilded?: boolean;
};

export function PFPanel({ gilded = false, className, ...props }: PFPanelProps) {
  return (
    <div
      {...props}
      className={cx(gilded ? "pf-gilded-frame" : "pf-panel", className)}
    />
  );
}
