import { Card } from "@/components/base/card";
import {
  UI_STATUS_SURFACE_CLASSES,
  UI_STATUS_TEXT_CLASSES,
} from "@/lib/ui-status";
import type { OutputPanelReviewStateTone } from "@/lib/output-panel-review-state";
import { cx } from "@/lib/utils/cx";

interface OutputPanelStateBannerProps {
  title: string;
  description: string;
  previewSourceLabel: string;
  statusLabel?: string | null;
  nextAction?: string;
  tone?: OutputPanelReviewStateTone;
  stateKey: string;
}

export function OutputPanelStateBanner({
  title,
  description,
  previewSourceLabel,
  statusLabel,
  nextAction,
  tone = "info",
  stateKey,
}: OutputPanelStateBannerProps) {
  return (
    <Card
      className={cx("space-y-3 border p-3", UI_STATUS_SURFACE_CLASSES[tone])}
      data-state={stateKey}
      data-testid="output-panel-state-banner"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className={cx("text-sm font-semibold", UI_STATUS_TEXT_CLASSES[tone])}>
            {title}
          </p>
          <p className="text-sm leading-6 text-foreground/85">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-foreground/80">
            Source: {previewSourceLabel}
          </span>
          {statusLabel ? (
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-foreground/80">
              Status: {statusLabel}
            </span>
          ) : null}
        </div>
      </div>
      {nextAction ? (
        <p className="text-xs leading-5 text-foreground/80">
          <span className="font-medium">Next:</span> {nextAction}
        </p>
      ) : null}
    </Card>
  );
}
