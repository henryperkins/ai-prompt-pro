import { Switch } from "@/components/base/primitives/switch";
import { Label } from "@/components/base/label";
import { ContextSourceChips } from "@/components/ContextSourceChips";
import { StructuredContextForm } from "@/components/StructuredContextForm";
import { ContextInterview } from "@/components/ContextInterview";
import { ProjectNotes } from "@/components/ProjectNotes";
import { ContextIntegrations } from "@/components/ContextIntegrations";
import { ContextQualityMeter } from "@/components/ContextQualityMeter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/tabs";
import { Globe } from "@phosphor-icons/react";
import type {
  ContextConfig,
  ContextSource,
  StructuredContext,
  InterviewAnswer,
  DatabaseConnection,
  RagParameters,
} from "@/lib/context-types";

interface ContextPanelProps {
  contextConfig: ContextConfig;
  onUpdateSources: (sources: ContextSource[]) => void;
  onUpdateDatabaseConnections: (connections: DatabaseConnection[]) => void;
  onUpdateRag: (updates: Partial<RagParameters>) => void;
  onUpdateStructured: (updates: Partial<StructuredContext>) => void;
  onUpdateInterview: (answers: InterviewAnswer[]) => void;
  onUpdateProjectNotes: (notes: string) => void;
  onToggleDelimiters: (value: boolean) => void;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: (value: boolean) => void;
  isEnhancing?: boolean;
}

export function ContextPanel({
  contextConfig,
  onUpdateSources,
  onUpdateDatabaseConnections,
  onUpdateRag,
  onUpdateStructured,
  onUpdateInterview,
  onUpdateProjectNotes,
  onToggleDelimiters,
  webSearchEnabled = false,
  onToggleWebSearch,
  isEnhancing = false,
}: ContextPanelProps) {
  const handleAddSource = (source: ContextSource) => {
    onUpdateSources([...contextConfig.sources, source]);
  };

  const handleRemoveSource = (id: string) => {
    onUpdateSources(contextConfig.sources.filter((s) => s.id !== id));
  };

  const structuredCount = Object.values(contextConfig.structured).filter(
    (v) => typeof v === "string" && v.trim().length > 0
  ).length;

  const hasNotes = contextConfig.projectNotes.trim().length > 0;
  const interviewCount = contextConfig.interviewAnswers.filter(
    (a) => a.answer.trim().length > 0
  ).length;
  const integrationCount =
    contextConfig.databaseConnections.length + (contextConfig.rag.enabled ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Sources — always visible */}
      <ContextSourceChips
        sources={contextConfig.sources}
        onAdd={handleAddSource}
        onRemove={handleRemoveSource}
      />

      <Tabs defaultValue="structured" className="w-full">
        <TabsList className="h-auto w-full grid grid-cols-2 gap-1 bg-muted/30 p-1 sm:grid-cols-4">
          <TabsTrigger value="structured" aria-label="Guided brief tab" className="interactive-chip h-11 px-2 text-sm sm:h-10 sm:text-sm">
            Guided brief{structuredCount > 0 ? ` (${structuredCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="integrations" aria-label="Connected data tab" className="interactive-chip h-11 px-2 text-sm sm:h-10 sm:text-sm">
            Connected data{integrationCount > 0 ? ` (${integrationCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="interview" aria-label="Guided Q&A tab" className="interactive-chip h-11 px-2 text-sm sm:h-10 sm:text-sm">
            Guided Q&amp;A{interviewCount > 0 ? ` (${interviewCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="notes" aria-label="Notes and constraints tab" className="interactive-chip h-11 px-2 text-sm sm:h-10 sm:text-sm">
            Notes &amp; constraints{hasNotes ? " (1)" : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structured" className="mt-3">
          <StructuredContextForm values={contextConfig.structured} onUpdate={onUpdateStructured} />
        </TabsContent>

        <TabsContent value="integrations" className="mt-3">
          <ContextIntegrations
            databaseConnections={contextConfig.databaseConnections}
            rag={contextConfig.rag}
            onUpdateDatabaseConnections={onUpdateDatabaseConnections}
            onUpdateRag={onUpdateRag}
          />
        </TabsContent>

        <TabsContent value="interview" className="mt-3">
          <ContextInterview answers={contextConfig.interviewAnswers} onUpdate={onUpdateInterview} />
        </TabsContent>

        <TabsContent value="notes" className="mt-3">
          <ProjectNotes value={contextConfig.projectNotes} onChange={onUpdateProjectNotes} />
        </TabsContent>
      </Tabs>

      {/* Settings & quality */}
      <div className="border-t border-border pt-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={contextConfig.useDelimiters}
                onCheckedChange={onToggleDelimiters}
              />
              <Label className="text-sm text-muted-foreground sm:text-base">
                Wrap context in XML-style tags
              </Label>
            </div>

            {onToggleWebSearch && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={webSearchEnabled}
                  onCheckedChange={onToggleWebSearch}
                  disabled={isEnhancing}
                  aria-label="Enable web search during enhancement"
                />
                <Label className="flex items-center gap-1.5 text-sm text-muted-foreground sm:text-base">
                  <Globe className="h-3.5 w-3.5" />
                  Use web lookup during enhancement
                </Label>
              </div>
            )}
          </div>

          <ContextQualityMeter contextConfig={contextConfig} />
        </div>
      </div>
    </div>
  );
}
