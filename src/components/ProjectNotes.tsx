import { TextArea } from "@/components/base/textarea";
import { Notepad as StickyNote } from "@phosphor-icons/react";

interface ProjectNotesProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProjectNotes({ value, onChange }: ProjectNotesProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
        <label className="text-sm font-medium text-foreground">
          Project notes
        </label>
        <span className="text-sm text-muted-foreground">(reusable across prompts)</span>
      </div>
      <TextArea
        placeholder="Persistent notes, brand voice guidelines, key facts, or any context you reuse across prompts..."
        aria-label="Project notes"
        value={value}
        onChange={onChange}
        textAreaClassName="min-h-[80px] bg-background"
      />
    </div>
  );
}
