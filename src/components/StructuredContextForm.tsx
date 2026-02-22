import { useState } from "react";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
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
      <label className="text-sm font-medium text-foreground sm:text-base">Structured context</label>
      {structuredFieldsMeta.map((field) => (
        <div key={field.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground sm:text-base">{field.label}</label>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 gap-0.5 px-2 text-sm text-muted-foreground sm:h-9 sm:text-base"
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
            className="bg-background"
          />
          {showExamples === field.key && (
            <div className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
              <p className="type-label-caps text-xs font-medium text-muted-foreground">
                Good examples
              </p>
              {field.examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => onUpdate({ [field.key]: ex })}
                  className="block w-full cursor-pointer py-0.5 text-left text-sm text-foreground transition-colors hover:text-primary sm:text-base"
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
