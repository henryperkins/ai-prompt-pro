import { Textarea } from "@/components/ui/textarea";
import { StickyNote } from "lucide-react";

interface ProjectNotesProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProjectNotes({ value, onChange }: ProjectNotesProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
        <label className="text-xs font-medium text-foreground">
          Project notes
        </label>
        <span className="text-[10px] text-muted-foreground">(reusable across prompts)</span>
      </div>
      <Textarea
        placeholder="Persistent notes, brand voice guidelines, key facts, or any context you reuse across prompts..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[80px] bg-background text-sm"
      />
    </div>
  );
}
