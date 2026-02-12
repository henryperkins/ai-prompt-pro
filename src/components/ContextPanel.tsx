import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ContextSourceChips } from "@/components/ContextSourceChips";
import { StructuredContextForm } from "@/components/StructuredContextForm";
import { ContextInterview } from "@/components/ContextInterview";
import { ProjectNotes } from "@/components/ProjectNotes";
import { ContextIntegrations } from "@/components/ContextIntegrations";
import { ContextQualityMeter } from "@/components/ContextQualityMeter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          <TabsTrigger value="structured" aria-label="Structured context tab" className="interactive-chip h-11 px-2 text-sm sm:h-10 sm:text-base">
            Structured{structuredCount > 0 ? ` (${structuredCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="integrations" aria-label="Integrations tab" className="interactive-chip h-11 px-2 text-sm sm:h-10 sm:text-base">
            Integrations{integrationCount > 0 ? ` (${integrationCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="interview" aria-label="Context interview tab" className="interactive-chip h-11 px-2 text-sm sm:h-10 sm:text-base">
            Interview{interviewCount > 0 ? ` (${interviewCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="notes" aria-label="Project notes tab" className="interactive-chip h-11 px-2 text-sm sm:h-10 sm:text-base">
            Notes{hasNotes ? " (1)" : ""}
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

      {/* Settings & quality — compact row */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <Switch
            checked={contextConfig.useDelimiters}
            onCheckedChange={onToggleDelimiters}
          />
          <Label className="text-sm text-muted-foreground sm:text-base">Delimiters</Label>
        </div>
        <ContextQualityMeter contextConfig={contextConfig} />
      </div>
    </div>
  );
}
