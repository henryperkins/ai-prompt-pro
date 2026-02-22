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
        glow: "drop-shadow(0 0 18px rgba(214,166,64,.35))",
      };
    case "Epic":
      return {
        stroke: "rgb(var(--pf-ember-rgb))",
        glow: "drop-shadow(0 0 18px rgba(255,122,24,.28))",
      };
    case "Rare":
      return {
        stroke: "rgb(var(--pf-arcane-rgb))",
        glow: "drop-shadow(0 0 18px rgba(18,200,181,.28))",
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
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="40%" stopColor={stroke} />
            <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(46,58,70,0.65)"
          strokeWidth={strokeWidth}
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
          fill="rgba(11,15,20,0.88)"
          stroke="rgba(214,166,64,0.25)"
        />

        <text
          x="50%"
          y="49%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={Math.round(size * 0.18)}
          fill="rgba(230,225,213,0.95)"
          fontWeight="800"
        >
          {Math.round(normalizedValue)}
        </text>
        <text
          x="50%"
          y="64%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={Math.round(size * 0.085)}
          fill="rgba(230,225,213,0.70)"
          fontWeight="700"
        >
          / 100
        </text>
      </svg>

      {showLabel && (
        <div>
          <div className="text-xs text-[rgba(230,225,213,.65)]">Quality tier</div>
          <div className="mt-1 text-lg font-extrabold text-[rgba(230,225,213,.95)]">{tier}</div>
        </div>
      )}
    </div>
  );
}
