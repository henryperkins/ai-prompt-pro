import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { Checkbox } from "@/components/base/primitives/checkbox";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/primitives/label";
import { Select } from "@/components/base/select/select";
import { Textarea } from "@/components/base/primitives/textarea";
import {
  PromptConfig,
  constraintOptions,
  formatOptions,
  lengthOptions,
  roles,
  toneOptions,
} from "@/lib/prompt-builder";
import { toConstraintInputId } from "@/lib/builder-tabs";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";

interface BuilderAdjustDetailsProps {
  config: PromptConfig;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updates: Partial<PromptConfig>) => void;
}

export function BuilderAdjustDetails({ config, isOpen, onOpenChange, onUpdate }: BuilderAdjustDetailsProps) {
  const selectedRole = config.customRole || config.role;
  const formatCount = config.format.length + (config.customFormat.trim() ? 1 : 0);
  const constraintCount = config.constraints.length + (config.customConstraint.trim() ? 1 : 0);

  const toggleFormat = (format: string) => {
    const next = config.format.includes(format)
      ? config.format.filter((entry) => entry !== format)
      : [...config.format, format];
    onUpdate({ format: next });
  };

  const toggleConstraint = (constraint: string) => {
    const next = config.constraints.includes(constraint)
      ? config.constraints.filter((entry) => entry !== constraint)
      : [...config.constraints, constraint];
    onUpdate({ constraints: next });
  };

  return (
    <Card id="builder-zone-2" className="border-border/70 bg-card/80 p-3 sm:p-4">
      <div className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => onOpenChange(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="builder-zone-2-content"
        >
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Adjust details
            </p>
            <p className="text-xs text-muted-foreground">Role, style, format, and constraints.</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRole && (
              <Badge type="modern" className="max-w-[180px] text-xs">
                <span className="type-wrap-safe">{selectedRole}</span>
              </Badge>
            )}
            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {!isOpen && (
          <p className="text-xs text-muted-foreground">
            {formatCount} format option{formatCount === 1 ? "" : "s"}, {constraintCount} constraint
            {constraintCount === 1 ? "" : "s"}, tone: {config.tone || "none"}.
          </p>
        )}

        {isOpen && (
          <div id="builder-zone-2-content" className="space-y-5 border-t border-border pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground">AI persona</Label>
                <Select
                  selectedKey={config.role || undefined}
                  onSelectionChange={(value) => {
                    if (value !== null) {
                      onUpdate({ role: String(value) });
                    }
                  }}
                  placeholder="Select a role"
                  aria-label="Select role"
                  className="bg-background"
                >
                  {roles.map((role) => (
                    <Select.Item key={role} id={role}>
                      {role}
                    </Select.Item>
                  ))}
                </Select>
                <Input
                  value={config.customRole}
                  onChange={(value) => onUpdate({ customRole: value })}
                  placeholder="Or use a custom role"
                  wrapperClassName="bg-background"
                  aria-label="Custom role"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground">Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {toneOptions.map((tone) => (
                    <Button
                      key={tone}
                      type="button"
                      size="sm"
                      color={config.tone === tone ? "primary" : "secondary"}
                      className="h-11 px-2 text-xs sm:h-9"
                      onClick={() => onUpdate({ tone })}
                      aria-pressed={config.tone === tone}
                    >
                      {tone}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">Output format</Label>
              <div className="flex flex-wrap gap-2">
                {formatOptions.map((format) => (
                  <Button
                    key={format}
                    type="button"
                    size="sm"
                    color={config.format.includes(format) ? "primary" : "secondary"}
                    className="h-11 px-2 text-xs sm:h-9"
                    onClick={() => toggleFormat(format)}
                    aria-pressed={config.format.includes(format)}
                  >
                    {format}
                  </Button>
                ))}
              </div>
              <Input
                value={config.customFormat}
                onChange={(value) => onUpdate({ customFormat: value })}
                placeholder="Custom format"
                wrapperClassName="bg-background"
                aria-label="Custom format"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">Length</Label>
              <Select
                selectedKey={config.lengthPreference || undefined}
                onSelectionChange={(value) => {
                  if (value !== null) {
                    onUpdate({ lengthPreference: String(value) });
                  }
                }}
                aria-label="Length preference"
                className="bg-background"
              >
                {lengthOptions.map((option) => (
                  <Select.Item key={option.value} id={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-medium text-foreground">Constraints</Label>
              <div className="space-y-2">
                {constraintOptions.map((constraint) => {
                  const inputId = toConstraintInputId(constraint);
                  return (
                    <div key={constraint} className="flex items-center gap-2">
                      <Checkbox
                        id={inputId}
                        checked={config.constraints.includes(constraint)}
                        onCheckedChange={() => toggleConstraint(constraint)}
                      />
                      <Label htmlFor={inputId} className="cursor-pointer text-sm">
                        {constraint}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <Input
                value={config.customConstraint}
                onChange={(value) => onUpdate({ customConstraint: value })}
                placeholder="Custom constraint"
                wrapperClassName="bg-background"
                aria-label="Custom constraint"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">Example output (optional)</Label>
              <Textarea
                value={config.examples}
                onChange={(e) => onUpdate({ examples: e.target.value })}
                placeholder="Include sample inputs/outputs for better fidelity"
                className="min-h-[100px] bg-background font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
