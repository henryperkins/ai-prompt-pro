import { Button } from "@/components/base/buttons/button";
import { toneOptions, complexityOptions } from "@/lib/prompt-builder";

interface ToneControlsProps {
  tone: string;
  complexity: string;
  onUpdate: (updates: { tone?: string; complexity?: string }) => void;
}

export function ToneControls({
  tone,
  complexity,
  onUpdate,
}: ToneControlsProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground sm:text-base">
          Tone
        </label>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            variant={tone === "" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onUpdate({ tone: "" })}
            aria-label="Let model decide tone"
            aria-pressed={tone === ""}
            className={`h-11 px-2 text-sm sm:h-9 sm:px-3 sm:text-sm ${tone === "" ? "ring-1 ring-primary/50" : ""}`}
          >
            Model decides
          </Button>
          {toneOptions.map((t) => (
            <Button
              key={t}
              variant={tone === t ? "primary" : "secondary"}
              size="sm"
              onClick={() => onUpdate({ tone: t })}
              aria-pressed={tone === t}
              className={`h-11 px-2 text-sm sm:h-9 sm:px-3 sm:text-sm ${tone === t ? "ring-1 ring-primary/50" : ""}`}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground sm:text-base">
          Complexity
        </label>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            variant={complexity === "" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onUpdate({ complexity: "" })}
            aria-label="Let model decide complexity"
            aria-pressed={complexity === ""}
            className={`h-11 px-2 text-sm sm:h-9 sm:px-3 sm:text-sm ${complexity === "" ? "ring-1 ring-primary/50" : ""}`}
          >
            Model decides
          </Button>
          {complexityOptions.map((c) => (
            <Button
              key={c}
              variant={complexity === c ? "primary" : "secondary"}
              size="sm"
              onClick={() => onUpdate({ complexity: c })}
              aria-pressed={complexity === c}
              className={`h-11 px-2 text-sm sm:h-9 sm:px-3 sm:text-sm ${complexity === c ? "ring-1 ring-primary/50" : ""}`}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
