import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/base/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/base/sheet";
import { TextArea } from "@/components/base/textarea";
import type { CodexSession } from "@/lib/codex-session";

const STATUS_META = {
  idle: { label: "Idle", tone: "default" },
  starting: { label: "Starting", tone: "brand" },
  streaming: { label: "Streaming", tone: "brand" },
  completed: { label: "Completed", tone: "brand" },
  failed: { label: "Failed", tone: "error" },
  aborted: { label: "Aborted", tone: "default" },
} as const;

function getSessionSummary(session: CodexSession): string {
  if (session.contextSummary.trim()) {
    return "Supplemental context will be carried into the next enhancement turn.";
  }
  if (session.threadId) {
    return "This session already has a live Codex thread. Add outside context before the next pass if needed.";
  }
  return "Add outside context or a carry-forward prompt before the next enhancement pass.";
}

function SessionBody({
  session,
  isEnhancing,
  currentPromptText,
  onOpenChange,
  onUpdateSession,
  onResetSession,
  onUseCurrentPrompt,
}: {
  session: CodexSession;
  isEnhancing: boolean;
  currentPromptText: string;
  onOpenChange: (open: boolean) => void;
  onUpdateSession: (updates: Partial<Pick<CodexSession, "contextSummary" | "latestEnhancedPrompt">>) => void;
  onResetSession: () => void;
  onUseCurrentPrompt: () => void;
}) {
  const statusMeta = STATUS_META[session.status];
  const hasCurrentPrompt = currentPromptText.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        <Card className="border-border/70 bg-card/80 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Carry-forward session</p>
              <p className="text-sm text-muted-foreground">
                {getSessionSummary(session)}
              </p>
            </div>
            <Badge variant="pill" tone={statusMeta.tone} className="text-xs">
              {statusMeta.label}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="type-label-caps text-2xs font-medium text-muted-foreground">
                Thread
              </p>
              <p className="mt-1 break-all text-xs text-foreground">
                {session.threadId ?? "New thread on next enhance"}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="type-label-caps text-2xs font-medium text-muted-foreground">
                Transport
              </p>
              <p className="mt-1 text-xs text-foreground">
                {session.transport ? session.transport.toUpperCase() : "Not established"}
              </p>
            </div>
          </div>
          {session.lastErrorMessage && (
            <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
              <p className="text-xs font-medium text-destructive">Last error</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.lastErrorMessage}
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-1.5">
          <label
            htmlFor="codex-session-context-summary"
            className="text-sm font-medium text-foreground"
          >
            Outside context summary
          </label>
          <p className="text-sm text-muted-foreground">
            Add the supplemental facts, constraints, URLs, or environment context Codex should remember for the next turn.
          </p>
          <TextArea
            id="codex-session-context-summary"
            data-testid="codex-session-context-summary"
            aria-label="Outside context summary"
            value={session.contextSummary}
            onChange={(value) => onUpdateSession({ contextSummary: value })}
            placeholder="Summarize what Codex should carry forward from you or from external sources."
            textAreaClassName="min-h-[140px] bg-background"
            isDisabled={isEnhancing}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <label
                htmlFor="codex-session-latest-prompt"
                className="text-sm font-medium text-foreground"
              >
                Carry-forward prompt
              </label>
              <p className="text-sm text-muted-foreground">
                Edit the prompt snapshot Codex should reference on the next enhancement turn.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onUseCurrentPrompt}
              disabled={isEnhancing || !hasCurrentPrompt}
            >
              Use current output
            </Button>
          </div>
          <TextArea
            id="codex-session-latest-prompt"
            data-testid="codex-session-latest-prompt"
            aria-label="Carry-forward prompt"
            value={session.latestEnhancedPrompt}
            onChange={(value) => onUpdateSession({ latestEnhancedPrompt: value })}
            placeholder="Paste or refine the prompt that should carry into the next Codex turn."
            textAreaClassName="min-h-[220px] bg-background font-mono text-sm"
            isDisabled={isEnhancing}
          />
        </div>

        <Card className="border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">Next turn behavior</p>
          <p className="mt-1 text-sm text-muted-foreground">
            PromptForge will send this session summary and carry-forward prompt back to Codex together with your current builder prompt.
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-4">
        <Button
          type="button"
          variant="secondary"
          tone="destructive"
          size="sm"
          onClick={onResetSession}
          disabled={isEnhancing}
        >
          Reset session
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

export interface CodexSessionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CodexSession;
  isEnhancing: boolean;
  isMobile: boolean;
  currentPromptText: string;
  onUpdateSession: (updates: Partial<Pick<CodexSession, "contextSummary" | "latestEnhancedPrompt">>) => void;
  onResetSession: () => void;
  onUseCurrentPrompt: () => void;
}

export function CodexSessionDrawer({
  open,
  onOpenChange,
  session,
  isEnhancing,
  isMobile,
  currentPromptText,
  onUpdateSession,
  onResetSession,
  onUseCurrentPrompt,
}: CodexSessionDrawerProps) {
  const body = (
    <SessionBody
      session={session}
      isEnhancing={isEnhancing}
      currentPromptText={currentPromptText}
      onOpenChange={onOpenChange}
      onUpdateSession={onUpdateSession}
      onResetSession={onResetSession}
      onUseCurrentPrompt={onUseCurrentPrompt}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Codex session</DrawerTitle>
            <DrawerDescription>
              Review and edit the carry-forward context that PromptForge sends into the next Codex enhancement turn.
            </DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-135">
        <SheetHeader>
          <SheetTitle>Codex session</SheetTitle>
          <SheetDescription>
            Review and edit the carry-forward context that PromptForge sends into the next Codex enhancement turn.
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}
