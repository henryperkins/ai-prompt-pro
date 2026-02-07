import { Button } from "@/components/ui/button";
import { toneOptions, complexityOptions } from "@/lib/prompt-builder";

interface ToneControlsProps {
  tone: string;
  complexity: string;
  onUpdate: (updates: { tone?: string; complexity?: string }) => void;
}

export function ToneControls({ tone, complexity, onUpdate }: ToneControlsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Tone</label>
        <div className="flex flex-wrap gap-2">
          {toneOptions.map((t) => (
            <Button
              key={t}
              variant={tone === t ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ tone: t })}
              className="text-xs"
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Complexity</label>
        <div className="flex flex-wrap gap-2">
          {complexityOptions.map((c) => (
            <Button
              key={c}
              variant={complexity === c ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ complexity: c })}
              className="text-xs"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
