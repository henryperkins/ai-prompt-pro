import { Card } from "@/components/base/primitives/card";
import { Progress } from "@/components/base/primitives/progress";
import { CheckCircle as CheckCircle2, WarningCircle as AlertCircle } from "@phosphor-icons/react";

interface QualityScoreProps {
  score: {
    total: number;
    clarity: number;
    context: number;
    specificity: number;
    structure: number;
    tips: string[];
  };
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}/{max}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export function QualityScore({ score }: QualityScoreProps) {
  const getColor = (total: number) => {
    if (total >= 75) return "text-primary";
    if (total >= 50) return "text-accent-foreground";
    return "text-destructive";
  };

  return (
    <Card className="p-3 sm:p-4 bg-card border-border">
      <div className="flex items-center gap-3 mb-3 sm:mb-4">
        <div className={`text-2xl sm:text-3xl font-bold ${getColor(score.total)}`}>{score.total}</div>
        <div>
          <p className="text-sm font-medium text-foreground">Quality Score</p>
          <p className="text-xs text-muted-foreground">out of 100</p>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
        <ScoreBar label="Clarity" value={score.clarity} max={25} />
        <ScoreBar label="Context" value={score.context} max={25} />
        <ScoreBar label="Specificity" value={score.specificity} max={25} />
        <ScoreBar label="Structure" value={score.structure} max={25} />
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        {score.tips.map((tip, i) => (
          <div key={i} className="flex gap-2 text-xs">
            {score.total >= 75 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <span className="text-muted-foreground">{tip}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
