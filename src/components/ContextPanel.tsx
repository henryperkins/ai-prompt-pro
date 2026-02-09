import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ContextSourceChips } from "@/components/ContextSourceChips";
import { StructuredContextForm } from "@/components/StructuredContextForm";
import { ContextInterview } from "@/components/ContextInterview";
import { ProjectNotes } from "@/components/ProjectNotes";
import { ContextIntegrations } from "@/components/ContextIntegrations";
import { ContextQualityMeter } from "@/components/ContextQualityMeter";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
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

function SectionCollapsible({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5">
          <ChevronRight
            className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          />
          {title}
        </span>
        {badge}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pb-2">{children}</CollapsibleContent>
    </Collapsible>
  );
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
    <div className="space-y-1">
      {/* Sources — always visible */}
      <ContextSourceChips
        sources={contextConfig.sources}
        onAdd={handleAddSource}
        onRemove={handleRemoveSource}
      />

      {/* Structured fields — collapsible */}
      <SectionCollapsible
        title="Structured Fields"
        badge={
          structuredCount > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {structuredCount} filled
            </Badge>
          ) : undefined
        }
      >
        <StructuredContextForm
          values={contextConfig.structured}
          onUpdate={onUpdateStructured}
        />
      </SectionCollapsible>

      <SectionCollapsible
        title="Integrations"
        badge={
          integrationCount > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {integrationCount} active
            </Badge>
          ) : undefined
        }
      >
        <ContextIntegrations
          databaseConnections={contextConfig.databaseConnections}
          rag={contextConfig.rag}
          onUpdateDatabaseConnections={onUpdateDatabaseConnections}
          onUpdateRag={onUpdateRag}
        />
      </SectionCollapsible>

      {/* Interview — collapsible */}
      <SectionCollapsible
        title="Context Interview"
        badge={
          interviewCount > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {interviewCount} answered
            </Badge>
          ) : undefined
        }
      >
        <ContextInterview
          answers={contextConfig.interviewAnswers}
          onUpdate={onUpdateInterview}
        />
      </SectionCollapsible>

      {/* Project notes — collapsible */}
      <SectionCollapsible
        title="Project Notes"
        badge={
          hasNotes ? (
            <Badge variant="secondary" className="text-[10px]">
              has notes
            </Badge>
          ) : undefined
        }
      >
        <ProjectNotes
          value={contextConfig.projectNotes}
          onChange={onUpdateProjectNotes}
        />
      </SectionCollapsible>

      {/* Settings & quality — compact row */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <Switch
            checked={contextConfig.useDelimiters}
            onCheckedChange={onToggleDelimiters}
            className="scale-90"
          />
          <Label className="text-[10px] text-muted-foreground">Delimiters</Label>
        </div>
        <ContextQualityMeter contextConfig={contextConfig} />
      </div>
    </div>
  );
}
