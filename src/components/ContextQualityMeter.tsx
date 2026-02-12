import { CheckCircle2, Circle } from "lucide-react";
import type { ContextConfig } from "@/lib/context-types";
import { scoreContext } from "@/lib/context-types";

interface ContextQualityMeterProps {
  contextConfig: ContextConfig;
}

export function ContextQualityMeter({ contextConfig }: ContextQualityMeterProps) {
  const { score, checks } = scoreContext(contextConfig);

  const getScoreColor = () => {
    if (score >= 75) return "text-primary";
    if (score >= 50) return "text-accent-foreground";
    return "text-destructive";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Context completeness</span>
        <span className={`text-xs font-bold ${getScoreColor()}`}>{score}%</span>
      </div>
      <div className="space-y-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-2">
            {check.met ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div>
              <span className="text-xs text-foreground">{check.label}</span>
              {!check.met && (
                <p className="text-xs text-muted-foreground">{check.tip}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
