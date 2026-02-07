import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ContextSourceChips } from "@/components/ContextSourceChips";
import { StructuredContextForm } from "@/components/StructuredContextForm";
import { ContextInterview } from "@/components/ContextInterview";
import { ProjectNotes } from "@/components/ProjectNotes";
import { ContextQualityMeter } from "@/components/ContextQualityMeter";
import type { ContextConfig, ContextSource, StructuredContext, InterviewAnswer } from "@/lib/context-types";

interface ContextPanelProps {
  contextConfig: ContextConfig;
  onUpdateSources: (sources: ContextSource[]) => void;
  onUpdateStructured: (updates: Partial<StructuredContext>) => void;
  onUpdateInterview: (answers: InterviewAnswer[]) => void;
  onUpdateProjectNotes: (notes: string) => void;
  onToggleDelimiters: (value: boolean) => void;
}

export function ContextPanel({
  contextConfig,
  onUpdateSources,
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

  return (
    <div className="space-y-4">
      <ContextSourceChips
        sources={contextConfig.sources}
        onAdd={handleAddSource}
        onRemove={handleRemoveSource}
      />

      <Separator />

      <StructuredContextForm
        values={contextConfig.structured}
        onUpdate={onUpdateStructured}
      />

      <Separator />

      <ContextInterview
        answers={contextConfig.interviewAnswers}
        onUpdate={onUpdateInterview}
      />

      <Separator />

      <ProjectNotes
        value={contextConfig.projectNotes}
        onChange={onUpdateProjectNotes}
      />

      <Separator />

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-xs">Delimit sections</Label>
          <p className="text-[10px] text-muted-foreground">
            Use XML-style tags so context doesn't bleed into instructions
          </p>
        </div>
        <Switch
          checked={contextConfig.useDelimiters}
          onCheckedChange={onToggleDelimiters}
        />
      </div>

      <Separator />

      <ContextQualityMeter contextConfig={contextConfig} />
    </div>
  );
}
