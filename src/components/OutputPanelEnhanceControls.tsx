import { Button } from "@/components/base/buttons/button";
import { Switch } from "@/components/base/switch";
import type { EnhancePhase } from "@/components/output-panel-types";
import type {
  AmbiguityMode,
  EnhancementDepth,
  RewriteStrictness,
} from "@/lib/user-preferences";
import {
  AMBIGUITY_MODE_OPTIONS,
  ENHANCEMENT_DEPTH_OPTIONS,
  REWRITE_STRICTNESS_OPTIONS,
} from "@/lib/enhancement-settings";
import { cx } from "@/lib/utils/cx";
import {
  Check,
  Globe,
  Sparkle as Sparkles,
  SpinnerGap as Loader2,
} from "@phosphor-icons/react";

function EnhanceOptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  layout = "inline",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  layout?: "inline" | "stacked";
}) {
  return (
    <div
      className={cx(
        layout === "stacked" ? "space-y-2" : "flex items-center gap-1.5",
      )}
      role="group"
      aria-label={label}
    >
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {layout === "inline" ? ":" : ""}
      </span>
      <div
        className={cx(
          "rounded-md border border-border/60 bg-muted/30 p-0.5",
          layout === "stacked"
            ? "flex flex-wrap items-center gap-0.5"
            : "inline-flex gap-0.5",
        )}
      >
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

interface SharedEnhancementControlsProps {
  webSearchEnabled: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  isEnhancing: boolean;
  enhancementDepth: EnhancementDepth;
  rewriteStrictness: RewriteStrictness;
  ambiguityMode: AmbiguityMode;
  onEnhancementDepthChange?: (depth: EnhancementDepth) => void;
  onRewriteStrictnessChange?: (strictness: RewriteStrictness) => void;
  onAmbiguityModeChange?: (mode: AmbiguityMode) => void;
}

export function EnhancementControlGroups({
  webSearchEnabled,
  onWebSearchToggle,
  isEnhancing,
  enhancementDepth,
  rewriteStrictness,
  ambiguityMode,
  onEnhancementDepthChange,
  onRewriteStrictnessChange,
  onAmbiguityModeChange,
  layout = "inline",
}: SharedEnhancementControlsProps & {
  layout?: "inline" | "stacked";
}) {
  const showOptionGroups = Boolean(
    onEnhancementDepthChange ||
      onRewriteStrictnessChange ||
      onAmbiguityModeChange,
  );

  return (
    <div className={cx("flex flex-col gap-2", layout === "stacked" && "gap-3")}>
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

      {showOptionGroups && (
        <div
          className={cx(
            layout === "stacked"
              ? "space-y-3"
              : "flex flex-wrap items-center gap-x-4 gap-y-1.5",
          )}
        >
          {onEnhancementDepthChange && (
            <EnhanceOptionGroup
              label="Depth"
              value={enhancementDepth}
              options={ENHANCEMENT_DEPTH_OPTIONS}
              onChange={onEnhancementDepthChange}
              disabled={isEnhancing}
              layout={layout}
            />
          )}
          {onRewriteStrictnessChange && (
            <EnhanceOptionGroup
              label="Strictness"
              value={rewriteStrictness}
              options={REWRITE_STRICTNESS_OPTIONS}
              onChange={onRewriteStrictnessChange}
              disabled={isEnhancing}
              layout={layout}
            />
          )}
          {onAmbiguityModeChange && (
            <EnhanceOptionGroup
              label="Ambiguity"
              value={ambiguityMode}
              options={AMBIGUITY_MODE_OPTIONS}
              onChange={onAmbiguityModeChange}
              disabled={isEnhancing}
              layout={layout}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function EnhancePrimaryButton({
  isEnhancing,
  onEnhance,
  builtPrompt,
  enhancePhase,
  enhanceLabel,
  size = "lg",
  fullWidth = true,
  className,
  dataTestId,
}: {
  isEnhancing: boolean;
  onEnhance: () => void;
  builtPrompt: string;
  enhancePhase: EnhancePhase;
  enhanceLabel: string;
  size?: "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  dataTestId?: string;
}) {
  return (
    <Button
      variant="primary"
      size={size}
      onClick={onEnhance}
      disabled={isEnhancing || !builtPrompt}
      className={cx(
        "signature-enhance-button gap-2",
        fullWidth && "w-full",
        className,
      )}
      data-phase={enhancePhase}
      data-testid={dataTestId}
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
  );
}

interface OutputPanelEnhanceControlsProps extends SharedEnhancementControlsProps {
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
      <EnhancementControlGroups
        webSearchEnabled={webSearchEnabled}
        onWebSearchToggle={onWebSearchToggle}
        isEnhancing={isEnhancing}
        enhancementDepth={enhancementDepth}
        rewriteStrictness={rewriteStrictness}
        ambiguityMode={ambiguityMode}
        onEnhancementDepthChange={onEnhancementDepthChange}
        onRewriteStrictnessChange={onRewriteStrictnessChange}
        onAmbiguityModeChange={onAmbiguityModeChange}
      />
      <EnhancePrimaryButton
        isEnhancing={isEnhancing}
        onEnhance={onEnhance}
        builtPrompt={builtPrompt}
        enhancePhase={enhancePhase}
        enhanceLabel={enhanceLabel}
      />
    </div>
  );
}
