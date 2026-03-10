import { Button } from "@/components/base/buttons/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/base/dropdown-menu";
import { OutputPanelDevTools } from "@/components/OutputPanelDevTools";
import {
  Check,
  Copy,
  DotsThreeOutline as MoreHorizontal,
  FloppyDisk as Save,
} from "@phosphor-icons/react";

interface OutputPanelHeaderProps {
  hasEnhancedPrompt: boolean;
  previewSourceLabel: string;
  statusLabel: string | null;
  hasCompare: boolean;
  hasEnhancedOnce: boolean;
  showUtilityActions: boolean;
  canUseSaveMenu: boolean;
  canSavePrompt: boolean;
  canSharePrompt: boolean;
  phase2Enabled: boolean;
  copied: boolean;
  isMobile: boolean;
  displayPrompt: string;
  onCopy: () => void;
  onOpenCompare: () => void;
  onTooMuchChanged: () => void;
  onOpenSaveDialog: (share: boolean) => void;
  onSaveVersion: () => void;
}

export function OutputPanelHeader({
  hasEnhancedPrompt,
  previewSourceLabel,
  statusLabel,
  hasCompare,
  hasEnhancedOnce,
  showUtilityActions,
  canUseSaveMenu,
  canSavePrompt,
  canSharePrompt,
  phase2Enabled,
  copied,
  isMobile,
  displayPrompt,
  onCopy,
  onOpenCompare,
  onTooMuchChanged,
  onOpenSaveDialog,
  onSaveVersion,
}: OutputPanelHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-foreground">
          {hasEnhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
        </h2>
        <span className="interactive-chip inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Source: {previewSourceLabel}
        </span>
        {statusLabel && (
          <span className="interactive-chip inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {statusLabel}
          </span>
        )}
        {hasCompare && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ui-toolbar-button px-2"
              onClick={onOpenCompare}
            >
              Show changes
            </Button>
            {hasEnhancedOnce && (
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                className="ui-toolbar-button px-2"
                onClick={onTooMuchChanged}
              >
                Too much changed
              </Button>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          variant="primary"
          size="sm"
          onClick={onCopy}
          disabled={!displayPrompt}
          className="ui-toolbar-button utility-action-button min-w-[84px]"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied!" : hasEnhancedOnce ? "Copy" : "Copy preview"}
        </Button>

        {showUtilityActions && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
