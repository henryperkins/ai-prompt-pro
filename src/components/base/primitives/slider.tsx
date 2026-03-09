import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cx } from "@/lib/utils/cx";

interface SliderProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    "onChange"
  > {
  label?: string;
  valueLabel?: string;
  onChange?: (value: number) => void;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, label, valueLabel, onChange, ...props }, ref) => (
  <div className="space-y-1.5">
    {(label || valueLabel) && (
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-sm text-muted-foreground">{label}</span>
        )}
        {valueLabel && (
          <span className="text-sm font-medium tabular-nums text-foreground">
            {valueLabel}
          </span>
        )}
      </div>
    )}
    <SliderPrimitive.Root
      ref={ref}
      className={cx(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      onValueChange={(values) => onChange?.(values[0])}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cx(
          "block h-5 w-5 rounded-full border-2 border-primary bg-background",
          "ring-offset-background transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      />
    </SliderPrimitive.Root>
  </div>
));
Slider.displayName = "Slider";

export { Slider };
export type { SliderProps };
