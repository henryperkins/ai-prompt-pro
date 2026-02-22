import type { HTMLAttributes } from "react";
import { cx } from "@/lib/utils/cx";

export type PFPanelProps = HTMLAttributes<HTMLDivElement> & {
  gilded?: boolean;
};

export function PFPanel({ gilded = false, className, ...props }: PFPanelProps) {
  return <div {...props} className={cx(gilded ? "pf-gilded-frame" : "pf-panel", className)} />;
}
