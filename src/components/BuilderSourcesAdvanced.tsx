import { useState } from "react";
import { ContextIntegrations } from "@/components/ContextIntegrations";
import { ContextSourceChips } from "@/components/ContextSourceChips";
import { ProjectNotes } from "@/components/ProjectNotes";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { Label } from "@/components/base/primitives/label";
import { Switch } from "@/components/base/primitives/switch";
import type {
  ContextConfig,
  ContextSource,
  DatabaseConnection,
  RagParameters,
} from "@/lib/context-types";
import { ChevronDown, ChevronRight, Database, Layers3, Settings2 } from "lucide-react";

interface BuilderSourcesAdvancedProps {
  contextConfig: ContextConfig;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSources: (sources: ContextSource[]) => void;
  onUpdateDatabaseConnections: (connections: DatabaseConnection[]) => void;
  onUpdateRag: (updates: Partial<RagParameters>) => void;
  onUpdateProjectNotes: (notes: string) => void;
  onToggleDelimiters: (value: boolean) => void;
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
}: BuilderSourcesAdvancedProps) {
  const sourceCount = contextConfig.sources.length;
  const hasAdvancedConfig =
    contextConfig.databaseConnections.length > 0 || contextConfig.rag.enabled || !contextConfig.useDelimiters;

  const [advancedVisibility, setAdvancedVisibility] = useState<"auto" | "shown" | "hidden">("auto");
  const showAdvanced = advancedVisibility === "auto" ? hasAdvancedConfig : advancedVisibility === "shown";

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
        >
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Layers3 className="h-4 w-4 text-muted-foreground" />
              Add sources or advanced settings
            </p>
            <p className="text-xs text-muted-foreground">Optional references and integrations.</p>
          </div>
          <div className="flex items-center gap-2">
            {sourceCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {sourceCount} source{sourceCount === 1 ? "" : "s"}
              </Badge>
            )}
            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {isOpen && (
          <div id="builder-zone-3-content" className="space-y-4 border-t border-border pt-3">
            <ContextSourceChips
              sources={contextConfig.sources}
              onAdd={handleAddSource}
              onRemove={handleRemoveSource}
            />

            <ProjectNotes value={contextConfig.projectNotes} onChange={onUpdateProjectNotes} />

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <p className="text-xs font-medium text-foreground">Show advanced integrations</p>
                <p className="text-xs text-muted-foreground">Database + RAG and delimiter controls.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={showAdvanced ? "secondary" : "outline"}
                className="h-11 gap-1.5 text-sm sm:h-9 sm:text-base"
                onClick={() =>
                  setAdvancedVisibility((previous) => {
                    const previousShown = previous === "auto" ? hasAdvancedConfig : previous === "shown";
                    return previousShown ? "hidden" : "shown";
                  })
                }
              >
                <Settings2 className="h-3.5 w-3.5" />
                {showAdvanced ? "Hide advanced" : "Show advanced"}
              </Button>
            </div>

            {showAdvanced && (
              <div className="space-y-4 rounded-lg border border-border/80 bg-background/60 p-3">
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
                    <Label className="text-sm font-medium text-foreground sm:text-base">Use delimiters</Label>
                    <p className="text-xs text-muted-foreground">Wrap context blocks in tags for stricter parsing.</p>
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
