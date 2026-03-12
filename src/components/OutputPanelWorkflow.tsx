import { Card } from "@/components/base/card";
import { cx } from "@/lib/utils/cx";
import type { EnhanceWorkflowStep } from "@/lib/enhance-workflow";
import {
  CheckCircle,
  CircleNotch,
  MinusCircle,
  WarningCircle,
} from "@phosphor-icons/react";

interface OutputPanelWorkflowProps {
  steps: EnhanceWorkflowStep[];
  isEnhancing?: boolean;
}

function renderStatusBadge(step: EnhanceWorkflowStep) {
  const statusLabel = step.status === "running"
    ? "Running"
    : step.status === "completed"
      ? "Done"
      : step.status === "skipped"
        ? "Skipped"
        : step.status === "failed"
          ? "Failed"
          : "Pending";

  const badgeClasses = step.status === "running"
    ? "border-primary/30 bg-primary/10 text-primary"
    : step.status === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : step.status === "failed"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border/60 bg-muted/50 text-muted-foreground";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        badgeClasses,
      )}
    >
      {statusLabel}
    </span>
  );
}

function renderStatusIcon(step: EnhanceWorkflowStep) {
  if (step.status === "running") {
    return <CircleNotch className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />;
  }
  if (step.status === "completed") {
    return (
      <CheckCircle
        className="h-4 w-4 text-emerald-700 dark:text-emerald-300"
        aria-hidden="true"
      />
    );
  }
  if (step.status === "failed") {
    return <WarningCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
  }
  return <MinusCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

export function OutputPanelWorkflow({
  steps,
  isEnhancing = false,
}: OutputPanelWorkflowProps) {
  if (steps.length === 0) return null;

  return (
    <Card
      className="border-border/60 bg-card/80 p-3"
      data-testid="output-panel-workflow"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ui-section-label text-muted-foreground">Workflow</p>
          <p className="mt-1 text-sm text-foreground">
            How the enhancement was assembled.
          </p>
        </div>
        <span
          className={cx(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            isEnhancing
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border/60 bg-muted/50 text-muted-foreground",
          )}
        >
          {isEnhancing ? "Live" : "Captured"}
        </span>
      </div>

      <ol className="mt-3 space-y-2" aria-label="Enhancement workflow steps">
        {steps.map((step, index) => (
          <li
            key={step.stepId}
            className="rounded-xl border border-border/60 bg-background/60 px-3 py-2"
            data-testid={`workflow-step-${step.stepId}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 shrink-0">{renderStatusIcon(step)}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {index + 1}.
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {step.label}
                    </p>
                  </div>
                  {step.detail && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0">{renderStatusBadge(step)}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
