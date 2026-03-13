import { Badge } from "@/components/base/badges/badges";
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

function getStatusBadgeTone(step: EnhanceWorkflowStep) {
  if (step.status === "running") {
    return "brand";
  }
  if (step.status === "completed") {
    return "success";
  }
  if (step.status === "failed") {
    return "error";
  }
  return "default";
}

function getStatusBadgeClassName(step: EnhanceWorkflowStep) {
  if (step.status === "completed") {
    return "bg-success-primary text-fg-success-primary ring-fg-success-primary/30";
  }
  if (step.status === "skipped" || step.status === "pending") {
    return "bg-muted/50 text-muted-foreground ring-border/60";
  }
  return undefined;
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

  return (
    <Badge
      size="sm"
      tone={getStatusBadgeTone(step)}
      className={getStatusBadgeClassName(step)}
    >
      {statusLabel}
    </Badge>
  );
}

function renderStatusIcon(step: EnhanceWorkflowStep) {
  if (step.status === "running") {
    return <CircleNotch className="size-4 animate-spin text-primary" aria-hidden="true" />;
  }
  if (step.status === "completed") {
    return (
      <CheckCircle
        className="size-4 text-fg-success-primary"
        aria-hidden="true"
      />
    );
  }
  if (step.status === "failed") {
    return <WarningCircle className="size-4 text-destructive" aria-hidden="true" />;
  }
  return <MinusCircle className="size-4 text-muted-foreground" aria-hidden="true" />;
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
        <Badge
          size="sm"
          tone={isEnhancing ? "brand" : "default"}
          className={!isEnhancing ? "bg-muted/50 text-muted-foreground ring-border/60" : undefined}
        >
          {isEnhancing ? "Live" : "Captured"}
        </Badge>
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
