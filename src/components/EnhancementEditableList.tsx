import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Textarea } from "@/components/base/textarea";
import type {
  EditableEnhancementListEdit,
  EditableEnhancementListField,
} from "@/lib/enhance-metadata";

function normalizeItems(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

function formatLabeledList(label: string, values: string[]): string {
  return [label, ...values.map((value, index) => `${index + 1}. ${value}`)].join("\n");
}

interface EnhancementEditableListProps {
  field: EditableEnhancementListField;
  label: string;
  items: string[];
  onItemSaved?: (edit: EditableEnhancementListEdit) => void;
  onApplyToPrompt?: (
    field: EditableEnhancementListField,
    items: string[],
  ) => void;
  onApplyToSessionContext?: (label: string, content: string) => void;
  onCopyText?: (label: string, content: string) => void;
}

export function EnhancementEditableList({
  field,
  label,
  items,
  onItemSaved,
  onApplyToPrompt,
  onApplyToSessionContext,
  onCopyText,
}: EnhancementEditableListProps) {
  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const [draftItems, setDraftItems] = useState(normalizedItems);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setDraftItems(normalizedItems);
    setEditingIndex(null);
    setEditingValue("");
    setValidationError(null);
  }, [normalizedItems]);

  if (draftItems.length === 0) return null;

  const hasEdits =
    draftItems.length !== normalizedItems.length ||
    draftItems.some((item, index) => item !== normalizedItems[index]);
  const content = formatLabeledList(label, draftItems);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(draftItems[index] ?? "");
    setValidationError(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditingValue("");
    setValidationError(null);
  };

  const handleSave = () => {
    if (editingIndex === null) return;

    const before = draftItems[editingIndex] ?? "";
    const after = editingValue.trim();
    if (!after) {
      setValidationError("Enter text before saving.");
      return;
    }

    setValidationError(null);
    setEditingIndex(null);
    setEditingValue("");

    if (after === before.trim()) {
      return;
    }

    setDraftItems((previous) => {
      const next = [...previous];
      next[editingIndex] = after;
      return next;
    });
    onItemSaved?.({
      field,
      index: editingIndex,
      before,
      after,
      source: "structured_inspector",
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-background/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {hasEdits && (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Edited
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {onApplyToPrompt && (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => onApplyToPrompt(field, draftItems)}
            >
              Apply to prompt
            </Button>
          )}
          {onApplyToSessionContext && (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => onApplyToSessionContext(label, content)}
            >
              Add to session context
            </Button>
          )}
          {onCopyText && (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => onCopyText(label, content)}
            >
              Copy
            </Button>
          )}
        </div>
      </div>

      <ol className="space-y-2 pl-4 text-xs leading-relaxed text-foreground/85">
        {draftItems.map((item, index) => {
          const isEditing = editingIndex === index;
          return (
            <li key={`${field}-${index}`} className="list-decimal space-y-1.5">
              {isEditing ? (
                <>
                  <Textarea
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    className="min-h-20 text-xs"
                    aria-label={`${label} ${index + 1}`}
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={handleSave}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="tertiary"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                  {validationError && (
                    <p className="text-[11px] text-destructive">{validationError}</p>
                  )}
                </>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <span className="flex-1 whitespace-pre-wrap">{item}</span>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => handleEdit(index)}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
