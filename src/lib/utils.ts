import type { ClassValue } from "clsx";
import { cx } from "@/lib/utils/cx";

/**
 * @deprecated Use `cx` from "@/lib/utils/cx" for all new work.
 * This alias remains only as a migration bridge while older files are updated.
 */
export function cn(...inputs: ClassValue[]) {
  return cx(...inputs);
}
