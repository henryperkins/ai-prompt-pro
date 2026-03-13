import { useState, type ReactNode } from "react";
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
  getEnhancementSettingsSummary,
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

interface EnhancementSettingsSummaryCardProps {
  summary: string;
  webSearchEnabled?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  actionExpanded?: boolean;
  actionControlsId?: string;
  actionTestId?: string;
  helperText?: string | null;
  children?: ReactNode;
}

export function EnhancementSettingsSummaryCard({
  summary,
  webSearchEnabled,
  onAction,
  actionLabel = "Edit settings",
  actionExpanded,
  actionControlsId,
  actionTestId,
  helperText = "These settings apply to the next enhancement run and do not change the draft content directly.",
  children,
}: EnhancementSettingsSummaryCardProps) {
  return (
    <div
      className="rounded-xl border border-border/70 bg-muted/30 px-3 py-3"
      data-testid="output-panel-enhancement-settings-summary"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="ui-section-label text-muted-foreground">
            Enhancement settings
          </p>
          <p className="text-sm text-foreground" title={summary}>
            <span className="font-medium text-foreground/85">Next run:</span>{" "}
            <span>{summary}</span>
          </p>
          {webSearchEnabled ? (
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-foreground/80">
              Web lookup {webSearchEnabled ? "on" : "off"}
            </span>
          ) : null}
          {helperText ? (
            <p className="text-xs text-muted-foreground">{helperText}</p>
          ) : null}
        </div>
        {onAction ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onAction}
            aria-expanded={actionExpanded}
            aria-controls={actionControlsId}
            data-testid={actionTestId}
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
      {children ? (
        <div className="mt-3 border-t border-border/60 pt-3">{children}</div>
      ) : null}
    </div>
  );
}

interface EnhancementPreferencesResetRowProps {
  preferredAcceptedFormat?: string | null;
  onResetPreferences?: () => void;
  className?: string;
}

export function EnhancementPreferencesResetRow({
  preferredAcceptedFormat,
  onResetPreferences,
  className,
}: EnhancementPreferencesResetRowProps) {
  if (!preferredAcceptedFormat && !onResetPreferences) return null;

  return (
    <div
      className={cx(
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      data-testid="enhancement-preferences-reset-row"
    >
      <div className="space-y-1">
        {preferredAcceptedFormat ? (
          <p className="text-xs text-muted-foreground">
            Most accepted structure: {preferredAcceptedFormat}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Reset learned enhancement defaults if the next run stops matching your workflow.
        </p>
      </div>
      {onResetPreferences ? (
        <Button
          type="button"
          variant="link"
          tone="destructive"
          size="sm"
          onClick={onResetPreferences}
        >
          Reset enhancement preferences
        </Button>
      ) : null}
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
  mode?: "full" | "compact";
  preferredAcceptedFormat?: string | null;
  canResetPreferences?: boolean;
  onResetPreferences?: () => void;
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
  mode = "full",
  preferredAcceptedFormat,
  canResetPreferences = false,
  onResetPreferences,
}: OutputPanelEnhanceControlsProps) {
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const canEditSettings = Boolean(
    onWebSearchToggle ||
      onEnhancementDepthChange ||
      onRewriteStrictnessChange ||
      onAmbiguityModeChange,
  );
  const summary = getEnhancementSettingsSummary({
    enhancementDepth,
    rewriteStrictness,
    ambiguityMode,
  });
  const compactSettingsEditorId = "output-panel-enhancement-settings-editor";

  if (mode === "compact") {
    return (
      <div
        className="flex flex-col gap-2"
        data-testid="output-panel-enhance-controls-compact"
      >
        <EnhancePrimaryButton
          isEnhancing={isEnhancing}
          onEnhance={onEnhance}
          builtPrompt={builtPrompt}
          enhancePhase={enhancePhase}
          enhanceLabel={enhanceLabel}
        />

        <EnhancementSettingsSummaryCard
          summary={summary}
          webSearchEnabled={webSearchEnabled}
          onAction={
            canEditSettings
              ? () => setIsSettingsExpanded((current) => !current)
              : undefined
          }
          actionLabel={isSettingsExpanded ? "Hide settings" : "Edit settings"}
          actionExpanded={isSettingsExpanded}
          actionControlsId={compactSettingsEditorId}
          actionTestId="output-panel-enhancement-settings-toggle"
          helperText={isSettingsExpanded ? "These settings apply to the next enhancement run." : null}
        >
          {isSettingsExpanded ? (
            <div className="space-y-3">
              <div id={compactSettingsEditorId}>
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
                  layout="stacked"
                />
              </div>
              {(canResetPreferences || preferredAcceptedFormat) && (
                <EnhancementPreferencesResetRow
                  preferredAcceptedFormat={preferredAcceptedFormat}
                  onResetPreferences={
                    canResetPreferences ? onResetPreferences : undefined
                  }
                />
              )}
            </div>
          ) : null}
        </EnhancementSettingsSummaryCard>
      </div>
    );
  }

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
      {(canResetPreferences || preferredAcceptedFormat) && (
        <EnhancementPreferencesResetRow
          preferredAcceptedFormat={preferredAcceptedFormat}
          onResetPreferences={canResetPreferences ? onResetPreferences : undefined}
          className="px-1 pt-1"
        />
      )}
    </div>
  );
}
