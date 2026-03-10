import { Button } from "@/components/base/buttons/button";
import { Switch } from "@/components/base/switch";
import type { EnhancePhase } from "@/components/output-panel-types";
import type {
  AmbiguityMode,
  EnhancementDepth,
  RewriteStrictness,
} from "@/lib/user-preferences";
import { cx } from "@/lib/utils/cx";
import {
  Check,
  Globe,
  Sparkle as Sparkles,
  SpinnerGap as Loader2,
} from "@phosphor-icons/react";

const ENHANCEMENT_DEPTH_OPTIONS: { value: EnhancementDepth; label: string }[] = [
  { value: "quick", label: "Light polish" },
  { value: "guided", label: "Structured rewrite" },
  { value: "advanced", label: "Expert prompt" },
];

const AMBIGUITY_MODE_OPTIONS: { value: AmbiguityMode; label: string }[] = [
  { value: "ask_me", label: "Ask me" },
  { value: "placeholders", label: "Use placeholders" },
  { value: "infer_conservatively", label: "Infer conservatively" },
];

const REWRITE_STRICTNESS_OPTIONS: {
  value: RewriteStrictness;
  label: string;
}[] = [
  { value: "preserve", label: "Preserve wording" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Optimize aggressively" },
];

function EnhanceOptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>
      <div className="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5 gap-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cx(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              option.value === value
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface OutputPanelEnhanceControlsProps {
  webSearchEnabled: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  isEnhancing: boolean;
  enhancementDepth: EnhancementDepth;
  rewriteStrictness: RewriteStrictness;
  ambiguityMode: AmbiguityMode;
  onEnhancementDepthChange?: (depth: EnhancementDepth) => void;
  onRewriteStrictnessChange?: (strictness: RewriteStrictness) => void;
  onAmbiguityModeChange?: (mode: AmbiguityMode) => void;
  onEnhance: () => void;
  builtPrompt: string;
  enhancePhase: EnhancePhase;
  enhanceLabel: string;
}

export function OutputPanelEnhanceControls({
  webSearchEnabled,
  onWebSearchToggle,
  isEnhancing,
  enhancementDepth,
  rewriteStrictness,
  ambiguityMode,
  onEnhancementDepthChange,
  onRewriteStrictnessChange,
  onAmbiguityModeChange,
  onEnhance,
  builtPrompt,
  enhancePhase,
  enhanceLabel,
}: OutputPanelEnhanceControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      {onWebSearchToggle ? (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Switch
            checked={webSearchEnabled}
            onCheckedChange={onWebSearchToggle}
            disabled={isEnhancing}
            aria-label="Enable web search during enhancement"
          />
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Web lookup</span>
        </label>
      ) : (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Web lookup: {webSearchEnabled ? "On" : "Off"}
        </p>
      )}

      {(onEnhancementDepthChange ||
        onRewriteStrictnessChange ||
        onAmbiguityModeChange) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {onEnhancementDepthChange && (
            <EnhanceOptionGroup
              label="Depth"
              value={enhancementDepth}
              options={ENHANCEMENT_DEPTH_OPTIONS}
              onChange={onEnhancementDepthChange}
              disabled={isEnhancing}
            />
          )}
          {onRewriteStrictnessChange && (
            <EnhanceOptionGroup
              label="Strictness"
              value={rewriteStrictness}
              options={REWRITE_STRICTNESS_OPTIONS}
              onChange={onRewriteStrictnessChange}
              disabled={isEnhancing}
            />
          )}
          {onAmbiguityModeChange && (
            <EnhanceOptionGroup
              label="Ambiguity"
              value={ambiguityMode}
              options={AMBIGUITY_MODE_OPTIONS}
              onChange={onAmbiguityModeChange}
              disabled={isEnhancing}
            />
          )}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        onClick={onEnhance}
        disabled={isEnhancing || !builtPrompt}
        className="signature-enhance-button w-full gap-2"
        data-phase={enhancePhase}
      >
        {isEnhancing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {enhanceLabel}
          </>
        ) : (
          <>
            {enhancePhase === "done" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {enhanceLabel}
          </>
        )}
      </Button>
    </div>
  );
}
