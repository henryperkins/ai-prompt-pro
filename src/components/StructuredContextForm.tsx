import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import type { StructuredContext } from "@/lib/context-types";
import { structuredFieldsMeta } from "@/lib/context-types";

interface StructuredContextFormProps {
  values: StructuredContext;
  onUpdate: (updates: Partial<StructuredContext>) => void;
}

export function StructuredContextForm({ values, onUpdate }: StructuredContextFormProps) {
  const [showExamples, setShowExamples] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-foreground">Structured context</label>
      {structuredFieldsMeta.map((field) => (
        <div key={field.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">{field.label}</label>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[11px] gap-0.5 text-muted-foreground"
              onClick={() =>
                setShowExamples(showExamples === field.key ? null : field.key)
              }
            >
              <Lightbulb className="w-3 h-3" />
              {showExamples === field.key ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
          </div>
          <Input
            placeholder={field.placeholder}
            value={values[field.key]}
            onChange={(e) => onUpdate({ [field.key]: e.target.value })}
            className="bg-background h-9 text-sm"
          />
          {showExamples === field.key && (
            <div className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Good examples
              </p>
              {field.examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => onUpdate({ [field.key]: ex })}
                  className="block w-full text-left text-xs text-foreground hover:text-primary transition-colors py-0.5 cursor-pointer"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
