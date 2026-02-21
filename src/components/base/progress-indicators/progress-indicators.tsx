import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  value: number;
  min?: number;
  max?: number;
  className?: string;
  progressClassName?: string;
  valueFormatter?: (value: number, valueInPercentage: number) => string | number;
}

type ProgressBarLabelPosition = "right" | "bottom" | "top-floating" | "bottom-floating";

export interface ProgressIndicatorWithTextProps extends ProgressBarProps {
  labelPosition?: ProgressBarLabelPosition;
}

function getProgressPercentage(value: number, min: number, max: number) {
  const range = max - min || 1;
  const raw = ((value - min) * 100) / range;
  return Math.min(100, Math.max(0, raw));
}

export const ProgressBarBase = ({ value, min = 0, max = 100, className, progressClassName }: ProgressBarProps) => {
  const percentage = getProgressPercentage(value, min, max);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        style={{ transform: `translateX(-${100 - percentage}%)` }}
        className={cn("h-full w-full rounded-full bg-primary transition-transform duration-150 ease-linear", progressClassName)}
      />
    </div>
  );
};

export const ProgressBar = ({
  value,
  min = 0,
  max = 100,
  valueFormatter,
  labelPosition,
  className,
  progressClassName,
}: ProgressIndicatorWithTextProps) => {
  const percentage = getProgressPercentage(value, min, max);
  const formattedValue = valueFormatter ? valueFormatter(value, percentage) : `${percentage.toFixed(0)}%`;
  const label = <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">{formattedValue}</span>;
  const bar = <ProgressBarBase min={min} max={max} value={value} className={className} progressClassName={progressClassName} />;

  if (labelPosition === "right") {
    return (
      <div className="flex items-center gap-3">
        {bar}
        {label}
      </div>
    );
  }

  if (labelPosition === "bottom") {
    return (
      <div className="flex flex-col gap-2">
        {bar}
        <div className="flex justify-end">{label}</div>
      </div>
    );
  }

  if (labelPosition === "top-floating" || labelPosition === "bottom-floating") {
    return (
      <div className="relative">
        {bar}
        <div
          style={{ left: `${percentage}%` }}
          className={cn(
            "absolute -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm tabular-nums",
            labelPosition === "top-floating" ? "-top-2 -translate-y-full" : "-bottom-2 translate-y-full",
          )}
        >
          {formattedValue}
        </div>
      </div>
    );
  }

  return bar;
};
