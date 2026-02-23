import { Textarea } from "@/components/base/primitives/textarea";
import { Button } from "@/components/base/buttons/button";
import { RotateCcw } from "lucide-react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function PromptInput({ value, onChange, onClear }: PromptInputProps) {
  const promptInputId = "builder-original-prompt";
  const promptInputMetaId = "builder-original-prompt-meta";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={promptInputId} className="text-sm font-medium text-foreground">
          Your Prompt
        </label>
        <div className="flex items-center gap-2">
          <span id={promptInputMetaId} className="text-xs text-muted-foreground">
            {value.length} chars
          </span>
          {value && (
            <Button
              color="tertiary"
              size="sm"
              onClick={onClear}
              aria-label="Clear prompt text"
              className="interactive-chip h-11 px-2 text-xs gap-1 sm:h-9"
            >
              <RotateCcw className="w-3 h-3" />
              Clear Prompt
            </Button>
          )}
        </div>
      </div>
      <Textarea
        id={promptInputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your basic prompt here... (e.g., 'Write a blog post about AI')"
        className="min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground sm:min-h-[120px]"
        aria-describedby={promptInputMetaId}
      />
    </div>
  );
}
