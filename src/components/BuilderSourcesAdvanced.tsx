import { useState } from "react";
import { ContextIntegrations } from "@/components/ContextIntegrations";
import { ContextSourceChips } from "@/components/ContextSourceChips";
import { ProjectNotes } from "@/components/ProjectNotes";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import { Label } from "@/components/base/label";
import { Switch } from "@/components/base/switch";
import {
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  Database,
  GearSix as Settings2,
  GitBranch,
  Stack as Layers3,
} from "@phosphor-icons/react";
import type {
  ContextConfig,
  ContextSource,
  DatabaseConnection,
  RagParameters,
} from "@/lib/context-types";

interface BuilderSourcesAdvancedProps {
  contextConfig: ContextConfig;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSources: (sources: ContextSource[]) => void;
  onUpdateDatabaseConnections: (connections: DatabaseConnection[]) => void;
  onUpdateRag: (updates: Partial<RagParameters>) => void;
  onUpdateProjectNotes: (notes: string) => void;
  onToggleDelimiters: (value: boolean) => void;
  githubPickerEnabled?: boolean;
  githubPickerDisabledReason?: string | null;
  onOpenGithubPicker?: () => void;
}

export function BuilderSourcesAdvanced({
  contextConfig,
  isOpen,
  onOpenChange,
  onUpdateSources,
  onUpdateDatabaseConnections,
  onUpdateRag,
  onUpdateProjectNotes,
  onToggleDelimiters,
  githubPickerEnabled = false,
  githubPickerDisabledReason = null,
  onOpenGithubPicker,
}: BuilderSourcesAdvancedProps) {
  const sourceCount = contextConfig.sources.length;
  const hasProjectNotes = Boolean(contextConfig.projectNotes.trim());
  const hasAdvancedConfig =
    contextConfig.databaseConnections.length > 0 ||
    contextConfig.rag.enabled ||
    !contextConfig.useDelimiters;

  const [advancedVisibility, setAdvancedVisibility] = useState<"auto" | "shown" | "hidden">("auto");
  const showAdvanced = advancedVisibility === "auto" ? hasAdvancedConfig : advancedVisibility === "shown";
  const advancedSummaryParts: string[] = [];
  if (contextConfig.databaseConnections.length > 0) {
    advancedSummaryParts.push(
      `${contextConfig.databaseConnections.length} integration${
        contextConfig.databaseConnections.length === 1 ? "" : "s"
      }`,
    );
  }
  if (contextConfig.rag.enabled) {
    advancedSummaryParts.push("RAG enabled");
  }
  if (!contextConfig.useDelimiters) {
    advancedSummaryParts.push("custom parsing");
  }
  const collapsedSummaryParts: string[] = [];
  if (sourceCount > 0) {
    collapsedSummaryParts.push(
      `${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
    );
  }
  if (hasProjectNotes) {
    collapsedSummaryParts.push("project notes");
  }
  if (advancedSummaryParts.length > 0) {
    collapsedSummaryParts.push(advancedSummaryParts.join(", "));
  }

  const handleAddSource = (source: ContextSource) => {
    onUpdateSources([...contextConfig.sources, source]);
  };

  const handleRemoveSource = (id: string) => {
    onUpdateSources(contextConfig.sources.filter((source) => source.id !== id));
  };

  return (
    <Card id="builder-zone-3" className="border-border/70 bg-card/80 p-3 sm:p-4">
      <div className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => onOpenChange(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="builder-zone-3-content"
          aria-label="Context and sources"
        >
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Layers3 className="h-4 w-4 text-muted-foreground" />
              Context and sources
            </p>
            <p className="text-sm text-muted-foreground" aria-hidden="true">
              Add references and notes that should shape the current draft prompt.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sourceCount > 0 && (
              <Badge variant="modern" className="text-xs">
                {sourceCount} source{sourceCount === 1 ? "" : "s"}
              </Badge>
            )}
            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {!isOpen && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {collapsedSummaryParts.length > 0
              ? collapsedSummaryParts.join(", ")
              : "No sources, notes, or advanced context configured yet."}
          </p>
        )}

        {isOpen && (
          <div id="builder-zone-3-content" className="space-y-4 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              These controls add context to the current draft. Enhancement settings such as web lookup and rewrite behavior live in the preview rail.
            </p>

            <ContextSourceChips
              sources={contextConfig.sources}
              onAdd={handleAddSource}
              onRemove={handleRemoveSource}
            />

            {githubPickerEnabled && onOpenGithubPicker && (
              <div className="rounded-lg border border-border/80 bg-background/60 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      GitHub repository context
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Search files from connected repositories and attach them as prompt context.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    iconLeading={GitBranch}
                    className="h-11 shrink-0 self-start text-sm sm:h-9"
                    onClick={onOpenGithubPicker}
                    disabled={Boolean(githubPickerDisabledReason)}
                  >
                    Add from GitHub
                  </Button>
                </div>
                {githubPickerDisabledReason && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {githubPickerDisabledReason}
                  </p>
                )}
              </div>
            )}

            <ProjectNotes value={contextConfig.projectNotes} onChange={onUpdateProjectNotes} />

            <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Advanced integrations</p>
                <p className="text-sm text-muted-foreground">
                  Database, RAG, and parsing controls for the draft context.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={showAdvanced ? "primary" : "secondary"}
                iconLeading={Settings2}
                className="h-11 shrink-0 self-start text-sm sm:h-9 sm:text-sm"
                onClick={() =>
                  setAdvancedVisibility((previous) => {
                    const previousShown = previous === "auto" ? hasAdvancedConfig : previous === "shown";
                    return previousShown ? "hidden" : "shown";
                  })
                }
              >
                {showAdvanced ? "Hide advanced" : "Show advanced"}
              </Button>
            </div>

            {showAdvanced && (
              <div
                className="space-y-4 rounded-lg border border-border/80 bg-background/60 p-3"
                data-testid="builder-context-advanced-section"
              >
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-sm font-medium text-foreground sm:text-base">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    Integrations
                  </Label>
                </div>

                <ContextIntegrations
                  databaseConnections={contextConfig.databaseConnections}
                  rag={contextConfig.rag}
                  onUpdateDatabaseConnections={onUpdateDatabaseConnections}
                  onUpdateRag={onUpdateRag}
                />

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <Label className="text-sm font-medium text-foreground sm:text-base">
                      Context parsing
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Wrap context blocks in XML-style tags inside the draft prompt.
                    </p>
                  </div>
                  <Switch
                    checked={contextConfig.useDelimiters}
                    onCheckedChange={onToggleDelimiters}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
