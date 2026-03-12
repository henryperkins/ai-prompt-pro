import { Button } from "@/components/base/buttons/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/base/drawer";
import { EnhancementControlGroups } from "@/components/OutputPanelEnhanceControls";
import { getEnhancementSettingsSummary } from "@/lib/enhancement-settings";
import type {
  AmbiguityMode,
  EnhancementDepth,
  RewriteStrictness,
} from "@/lib/user-preferences";

interface MobileEnhancementSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  isEnhancing: boolean;
  enhancementDepth: EnhancementDepth;
  rewriteStrictness: RewriteStrictness;
  ambiguityMode: AmbiguityMode;
  onEnhancementDepthChange: (depth: EnhancementDepth) => void;
  onRewriteStrictnessChange: (strictness: RewriteStrictness) => void;
  onAmbiguityModeChange: (mode: AmbiguityMode) => void;
  showCodexSession?: boolean;
  codexSessionSummary?: string;
  onOpenCodexSession?: () => void;
}

export function MobileEnhancementSettingsSheet({
  open,
  onOpenChange,
  webSearchEnabled,
  onWebSearchToggle,
  isEnhancing,
  enhancementDepth,
  rewriteStrictness,
  ambiguityMode,
  onEnhancementDepthChange,
  onRewriteStrictnessChange,
  onAmbiguityModeChange,
  showCodexSession = false,
  codexSessionSummary,
  onOpenCodexSession,
}: MobileEnhancementSettingsSheetProps) {
  const summary = getEnhancementSettingsSummary({
    enhancementDepth,
    rewriteStrictness,
    ambiguityMode,
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[85vh]"
        data-testid="builder-mobile-settings-sheet"
      >
        <DrawerHeader className="border-b border-border/60 px-4 pb-3 pt-2.5">
          <DrawerTitle className="text-base">Enhancement settings</DrawerTitle>
          <DrawerDescription className="sr-only">
            Adjust how the next enhancement run rewrites your prompt.
          </DrawerDescription>
          <p
            className="text-xs text-muted-foreground"
            data-testid="builder-mobile-settings-sheet-summary"
            title={summary}
          >
            Next run: {summary}
          </p>
        </DrawerHeader>

        <div className="space-y-4 overflow-auto px-4 pb-6 pt-4">
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

          {showCodexSession && (
            <div
              className="space-y-3 rounded-xl border border-border/70 bg-card/50 p-3"
              data-testid="builder-mobile-codex-session-section"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Codex session
                </p>
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="builder-mobile-codex-session-summary"
                >
                  {codexSessionSummary}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={onOpenCodexSession}
              >
                Open session
              </Button>
            </div>
          )}

          <p className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            These controls change the next enhancement request without moving the
            main Enhance action out of the sticky bar.
          </p>

          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
