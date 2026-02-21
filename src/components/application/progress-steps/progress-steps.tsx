import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProgressStepStatus = "complete" | "current" | "upcoming";

export interface ProgressStepItem {
  id: string;
  title: string;
  description?: string;
  status: ProgressStepStatus;
}

interface ProgressStepsProps {
  steps: ProgressStepItem[];
  showNumbers?: boolean;
  className?: string;
}

function circleStyles(status: ProgressStepStatus) {
  if (status === "complete") {
    return "border-primary bg-primary text-primary-foreground";
  }

  if (status === "current") {
    return "border-primary bg-card text-primary";
  }

  return "border-border bg-card text-muted-foreground";
}

function lineStyles(status: ProgressStepStatus) {
  return status === "complete" ? "bg-primary" : "bg-border";
}

export const ProgressSteps = ({ steps, showNumbers = false, className }: ProgressStepsProps) => {
  return (
    <ol className={cn("w-full", className)}>
      <li className="grid gap-4 sm:grid-cols-[repeat(var(--step-count),minmax(0,1fr))]" style={{ ["--step-count" as string]: String(steps.length) }}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const markerContent =
            step.status === "complete" && !showNumbers ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <span className="text-xs font-semibold">{index + 1}</span>
            );

          return (
            <div key={step.id} className="relative">
              {!isLast && (
                <span
                  className={cn("absolute left-8 right-0 top-3 hidden h-0.5 sm:block", lineStyles(step.status))}
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start gap-3">
                <span
                  className={cn(
                    "relative z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    circleStyles(step.status),
                  )}
                  aria-hidden="true"
                >
                  {markerContent}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {step.title}
                  </span>
                  {step.description ? <span className="text-xs text-muted-foreground">{step.description}</span> : null}
                </span>
              </div>
            </div>
          );
        })}
      </li>
    </ol>
  );
};
