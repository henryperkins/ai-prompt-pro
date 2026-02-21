import { Button } from "@/components/base/primitives/button";
import { toneOptions, complexityOptions } from "@/lib/prompt-builder";

interface ToneControlsProps {
  tone: string;
  complexity: string;
  onUpdate: (updates: { tone?: string; complexity?: string }) => void;
}

export function ToneControls({ tone, complexity, onUpdate }: ToneControlsProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground sm:text-base">Tone</label>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {toneOptions.map((t) => (
            <Button
              key={t}
              variant={tone === t ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ tone: t })}
              className="h-11 px-2 text-sm sm:h-9 sm:px-3 sm:text-base"
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground sm:text-base">Complexity</label>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {complexityOptions.map((c) => (
            <Button
              key={c}
              variant={complexity === c ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ complexity: c })}
              className="h-11 px-2 text-sm sm:h-9 sm:px-3 sm:text-base"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
