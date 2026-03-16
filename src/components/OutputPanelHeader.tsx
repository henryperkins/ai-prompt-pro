import { Button } from "@/components/base/buttons/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/base/dropdown-menu";
import { OutputPanelDevTools } from "@/components/OutputPanelDevTools";
import type { EnhancementVariant } from "@/components/output-panel-types";
import {
  Check,
  Copy,
  DotsThreeOutline as MoreHorizontal,
  FloppyDisk as Save,
} from "@phosphor-icons/react";

const VARIANT_LABELS: Record<EnhancementVariant, string> = {
  original: "Original",
  shorter: "Use shorter",
  more_detailed: "Use more detailed",
};

interface OutputPanelHeaderProps {
  copyLabel: string;
  hasCompare: boolean;
  showTooMuchChanged: boolean;
  showUtilityActions: boolean;
  canUseSaveMenu: boolean;
  canUseMoreMenu: boolean;
  canSavePrompt: boolean;
  canSharePrompt: boolean;
  shareDisabledReason?: string | null;
  phase2Enabled: boolean;
  copied: boolean;
  isMobile: boolean;
  displayPrompt: string;
  activeVariant: EnhancementVariant;
  availableVariants: EnhancementVariant[];
  onCopy: () => void;
  onOpenCompare: () => void;
  onTooMuchChanged: () => void;
  onOpenSaveDialog: (share: boolean) => void;
  onSaveVersion: () => void;
  onVariantChange?: (variant: EnhancementVariant) => void;
}

export function OutputPanelHeader({
  copyLabel,
  hasCompare,
  showTooMuchChanged,
  showUtilityActions,
  canUseSaveMenu,
  canUseMoreMenu,
  canSavePrompt,
  canSharePrompt,
  shareDisabledReason = null,
  phase2Enabled,
  copied,
  isMobile,
  displayPrompt,
  activeVariant,
  availableVariants,
  onCopy,
  onOpenCompare,
  onTooMuchChanged,
  onOpenSaveDialog,
  onSaveVersion,
  onVariantChange,
}: OutputPanelHeaderProps) {
  const showVariantControls = Boolean(
    onVariantChange && availableVariants.length > 1,
  );

  return (
    <div className="space-y-2" data-testid="output-panel-review-actions">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onCopy}
            disabled={!displayPrompt}
            className="ui-toolbar-button utility-action-button min-w-[132px]"
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied!" : copyLabel}
          </Button>

          {hasCompare ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ui-toolbar-button px-2"
              onClick={onOpenCompare}
            >
              Show changes
            </Button>
          ) : null}

          {showTooMuchChanged ? (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="ui-toolbar-button px-2"
              onClick={onTooMuchChanged}
            >
              Too much changed
            </Button>
          ) : null}
        </div>

        {showUtilityActions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canUseSaveMenu}
                  className="ui-toolbar-button gap-1.5"
                >
                  <Save className="h-3 w-3" />
                  Save
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {phase2Enabled ? (
                  <DropdownMenuItem
                    disabled={!canSavePrompt}
                    onSelect={() => onOpenSaveDialog(false)}
                  >
                    Save Prompt
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      disabled={!canSavePrompt}
                      onSelect={() => onOpenSaveDialog(false)}
                    >
                      Save Prompt
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canSharePrompt}
                      onSelect={() => onOpenSaveDialog(true)}
                    >
                      Save & Share Prompt
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  disabled={!displayPrompt}
                  onSelect={onSaveVersion}
                >
                  Save Version
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="tertiary"
                  size="sm"
                  disabled={!canUseMoreMenu}
                  className="ui-toolbar-button gap-1.5"
                >
                  <MoreHorizontal className="h-3 w-3" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <OutputPanelDevTools
                  displayPrompt={displayPrompt}
                  isMobile={isMobile}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {!canSharePrompt && shareDisabledReason ? (
        <p className="text-xs text-muted-foreground">{shareDisabledReason}</p>
      ) : null}

      {showVariantControls ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Versions:</span>
          {availableVariants.map((variant) => (
            <Button
              key={variant}
              type="button"
              variant={activeVariant === variant ? "primary" : "secondary"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onVariantChange?.(variant)}
            >
              {VARIANT_LABELS[variant]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
