import * as React from "react";

import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value?: number;
  min?: number;
  max?: number;
  className?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value = 0, min, max }, ref) => (
  <div ref={ref} className="w-full">
    <ProgressBarBase
      value={value}
      min={min}
      max={max}
      className={cn("h-4 bg-tertiary", className)}
      progressClassName="bg-brand-solid"
    />
  </div>
));
Progress.displayName = "Progress";

export { Progress };
