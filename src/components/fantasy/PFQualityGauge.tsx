import { useId } from "react";

export type PFQualityGaugeProps = {
  value: number;
  size?: number;
  showLabel?: boolean;
};

type Tier = "Common" | "Rare" | "Epic" | "Legendary";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getTier(value: number): Tier {
  if (value >= 90) return "Legendary";
  if (value >= 70) return "Epic";
  if (value >= 40) return "Rare";
  return "Common";
}

function getTierStroke(tier: Tier): { stroke: string; glow: string } {
  switch (tier) {
    case "Legendary":
      return {
        stroke: "rgb(var(--pf-gold-rgb))",
        glow: "drop-shadow(0 0 18px rgb(var(--pf-gold-rgb) / 0.35))",
      };
    case "Epic":
      return {
        stroke: "rgb(var(--pf-ember-rgb))",
        glow: "drop-shadow(0 0 18px rgb(var(--pf-ember-rgb) / 0.28))",
      };
    case "Rare":
      return {
        stroke: "rgb(var(--pf-arcane-rgb))",
        glow: "drop-shadow(0 0 18px rgb(var(--pf-arcane-rgb) / 0.28))",
      };
    default:
      return {
        stroke: "rgb(var(--pf-slate-rgb))",
        glow: "none",
      };
  }
}

export function PFQualityGauge({ value, size = 128, showLabel = true }: PFQualityGaugeProps) {
  const normalizedValue = clamp(value, 0, 100);
  const tier = getTier(normalizedValue);
  const { stroke, glow } = getTierStroke(tier);
  const gradientStart = "rgb(var(--pf-parchment-rgb) / 0.35)";
  const gradientEnd = "rgb(var(--pf-coal-rgb) / 0.35)";
  const trackStroke = "rgb(var(--pf-slate-rgb) / 0.65)";
  const centerFill = "rgb(var(--pf-coal-rgb) / 0.88)";
  const centerStroke = "rgb(var(--pf-gold-rgb) / 0.25)";
  const valueFill = "rgb(var(--pf-parchment-rgb) / 0.95)";
  const totalFill = "rgb(var(--pf-parchment-rgb) / 0.70)";

  const strokeWidth = Math.max(10, Math.round(size * 0.09));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - normalizedValue / 100);

  const gradientId = useId();

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: glow }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradientStart} />
            <stop offset="40%" stopColor={stroke} />
            <stop offset="100%" stopColor={gradientEnd} />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          style={{ stroke: trackStroke }}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={Math.max(18, radius - strokeWidth * 0.75)}
          style={{ fill: centerFill, stroke: centerStroke }}
        />

        <text
          x="50%"
          y="49%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={Math.round(size * 0.18)}
          fontWeight="800"
          style={{ fill: valueFill }}
        >
          {Math.round(normalizedValue)}
        </text>
        <text
          x="50%"
          y="64%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={Math.round(size * 0.085)}
          fontWeight="700"
          style={{ fill: totalFill }}
        >
          / 100
        </text>
      </svg>

      {showLabel && (
        <div>
          <div className="text-xs text-muted-foreground">Quality tier</div>
          <div className="mt-1 text-lg font-extrabold text-foreground">{tier}</div>
        </div>
      )}
    </div>
  );
}
