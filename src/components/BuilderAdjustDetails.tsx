import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
              <Badge variant="secondary" className="max-w-[140px] truncate text-xs">
                {selectedRole}
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
                <Select value={config.role} onValueChange={(value) => onUpdate({ role: value })}>
                  <SelectTrigger className="bg-background" aria-label="Select role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={config.customRole}
                  onChange={(e) => onUpdate({ customRole: e.target.value })}
                  placeholder="Or use a custom role"
                  className="bg-background"
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
                      variant={config.tone === tone ? "default" : "outline"}
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
                    variant={config.format.includes(format) ? "default" : "outline"}
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
                onChange={(e) => onUpdate({ customFormat: e.target.value })}
                placeholder="Custom format"
                className="bg-background"
                aria-label="Custom format"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">Length</Label>
              <Select
                value={config.lengthPreference}
                onValueChange={(value) => onUpdate({ lengthPreference: value })}
              >
                <SelectTrigger className="bg-background" aria-label="Length preference">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lengthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
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
                onChange={(e) => onUpdate({ customConstraint: e.target.value })}
                placeholder="Custom constraint"
                className="bg-background"
                aria-label="Custom constraint"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">Example output (optional)</Label>
              <Textarea
                value={config.examples}
                onChange={(e) => onUpdate({ examples: e.target.value })}
                placeholder="Include sample inputs/outputs for better fidelity"
                className="min-h-[100px] bg-background font-mono text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
