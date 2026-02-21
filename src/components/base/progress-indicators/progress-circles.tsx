import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  min?: number;
  max?: number;
  size: "xxs" | "xs" | "sm" | "md" | "lg";
  label?: string;
  valueFormatter?: (value: number, valueInPercentage: number) => string | number;
}

const sizes = {
  xxs: {
    strokeWidth: 6,
    radius: 28,
    valueClass: "text-sm font-semibold text-foreground",
    labelClass: "text-xs font-medium text-muted-foreground",
    halfCircleTextPosition: "absolute bottom-0 text-center",
  },
  xs: {
    strokeWidth: 10,
    radius: 48,
    valueClass: "text-xl font-semibold text-foreground",
    labelClass: "text-xs font-medium text-muted-foreground",
    halfCircleTextPosition: "absolute bottom-0 text-center",
  },
  sm: {
    strokeWidth: 12,
    radius: 60,
    valueClass: "text-2xl font-semibold text-foreground",
    labelClass: "text-xs font-medium text-muted-foreground",
    halfCircleTextPosition: "absolute bottom-0 text-center",
  },
  md: {
    strokeWidth: 14,
    radius: 72,
    valueClass: "text-3xl font-semibold text-foreground",
    labelClass: "text-sm font-medium text-muted-foreground",
    halfCircleTextPosition: "absolute bottom-0 text-center",
  },
  lg: {
    strokeWidth: 16,
    radius: 84,
    valueClass: "text-4xl font-semibold text-foreground",
    labelClass: "text-sm font-medium text-muted-foreground",
    halfCircleTextPosition: "absolute bottom-0 text-center",
  },
} as const;

function getPercentage(value: number, min: number, max: number) {
  const range = max - min || 1;
  const raw = ((value - min) * 100) / range;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export const ProgressBarCircle = ({ value, min = 0, max = 100, size, label, valueFormatter }: ProgressBarProps) => {
  const percentage = getPercentage(value, min, max);
  const sizeConfig = sizes[size];
  const { strokeWidth, radius, valueClass, labelClass } = sizeConfig;

  const diameter = 2 * (radius + strokeWidth / 2);
  const cx = diameter / 2;
  const cy = diameter / 2;
  const valueText = valueFormatter ? valueFormatter(value, percentage) : `${percentage}%`;
  const strokeDashoffset = 100 - percentage;

  return (
    <div className="flex flex-col items-center gap-1">
      <div role="progressbar" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} className="relative flex w-max items-center justify-center">
        <svg className="-rotate-90" width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`}>
          <circle
            className="stroke-muted"
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            pathLength="100"
            strokeDasharray="100"
            strokeLinecap="round"
          />
          <circle
            className="stroke-primary"
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            pathLength="100"
            strokeDasharray="100"
            strokeLinecap="round"
            strokeDashoffset={strokeDashoffset}
          />
        </svg>

        {label && size !== "xxs" ? (
          <div className="absolute text-center">
            <div className={labelClass}>{label}</div>
            <div className={valueClass}>{valueText}</div>
          </div>
        ) : (
          <span className={cn("absolute text-center", valueClass)}>{valueText}</span>
        )}
      </div>

      {label && size === "xxs" && <div className={labelClass}>{label}</div>}
    </div>
  );
};

export const ProgressBarHalfCircle = ({ value, min = 0, max = 100, size, label, valueFormatter }: ProgressBarProps) => {
  const percentage = getPercentage(value, min, max);
  const sizeConfig = sizes[size];
  const { strokeWidth, radius, valueClass, labelClass, halfCircleTextPosition } = sizeConfig;

  const width = 2 * (radius + strokeWidth / 2);
  const height = radius + strokeWidth;
  const valueText = valueFormatter ? valueFormatter(value, percentage) : `${percentage}%`;
  const strokeDashoffset = -50 - (100 - percentage) / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div role="progressbar" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} className="relative flex w-max items-center justify-center">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <circle
            className="stroke-muted"
            cx="50%"
            cy={radius + strokeWidth / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset="-50"
            strokeLinecap="round"
          />
          <circle
            className="origin-center -scale-x-100 stroke-primary"
            cx="50%"
            cy={radius + strokeWidth / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {label && size !== "xxs" ? (
          <div className={halfCircleTextPosition}>
            <div className={labelClass}>{label}</div>
            <div className={valueClass}>{valueText}</div>
          </div>
        ) : (
          <span className={cn(halfCircleTextPosition, valueClass)}>{valueText}</span>
        )}
      </div>

      {label && size === "xxs" && <div className={labelClass}>{label}</div>}
    </div>
  );
};
