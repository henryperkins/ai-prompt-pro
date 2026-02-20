import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { badgeVariants } from "@/components/ui/badge";
import { User, Target, Layout, Lightbulb, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { toConstraintInputId } from "@/lib/builder-tabs";
import {
  PromptConfig,
  roles,
  formatOptions,
  constraintOptions,
  lengthOptions,
} from "@/lib/prompt-builder";

interface BuilderTabsProps {
  config: PromptConfig;
  onUpdate: (updates: Partial<PromptConfig>) => void;
}

export function BuilderTabs({ config, onUpdate }: BuilderTabsProps) {
  const toggleFormat = (format: string) => {
    const next = config.format.includes(format)
      ? config.format.filter((f) => f !== format)
      : [...config.format, format];
    onUpdate({ format: next });
  };

  const toggleConstraint = (constraint: string) => {
    const next = config.constraints.includes(constraint)
      ? config.constraints.filter((c) => c !== constraint)
      : [...config.constraints, constraint];
    onUpdate({ constraints: next });
  };

  return (
    <Tabs defaultValue="role" className="w-full">
      <TabsList className="w-full grid grid-cols-5 h-auto gap-1 bg-muted/30 p-1">
        <TabsTrigger value="role" aria-label="Role tab" className="interactive-chip gap-1 text-xs px-2">
          <User className="w-3 h-3" />
          <span className="sm:hidden">Role</span>
          <span className="hidden sm:inline">Role</span>
        </TabsTrigger>
        <TabsTrigger value="task" aria-label="Task tab" className="interactive-chip gap-1 text-xs px-2">
          <Target className="w-3 h-3" />
          <span className="sm:hidden">Task</span>
          <span className="hidden sm:inline">Task</span>
        </TabsTrigger>
        <TabsTrigger value="format" aria-label="Format tab" className="interactive-chip gap-1 text-xs px-2">
          <Layout className="w-3 h-3" />
          <span className="sm:hidden">Fmt</span>
          <span className="hidden sm:inline">Format</span>
        </TabsTrigger>
        <TabsTrigger value="examples" aria-label="Examples tab" className="interactive-chip gap-1 text-xs px-2">
          <Lightbulb className="w-3 h-3" />
          <span className="sm:hidden">Ex</span>
          <span className="hidden sm:inline">Examples</span>
        </TabsTrigger>
        <TabsTrigger value="constraints" aria-label="Rules tab" className="interactive-chip gap-1 text-xs px-2">
          <Shield className="w-3 h-3" />
          <span className="sm:hidden">Rules</span>
          <span className="hidden sm:inline">Rules</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="role" className="space-y-3 mt-4">
        <p className="text-xs text-muted-foreground">Who should the AI be?</p>
        <Select value={config.role} onValueChange={(v) => onUpdate({ role: v })}>
          <SelectTrigger className="bg-background" aria-label="Select role">
            <SelectValue placeholder="Select a role..." />
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
          placeholder="Or type a custom role..."
          value={config.customRole}
          onChange={(e) => onUpdate({ customRole: e.target.value })}
          className="bg-background"
          aria-label="Custom role input"
        />
      </TabsContent>

      <TabsContent value="task" className="space-y-3 mt-4">
        <p className="text-xs text-muted-foreground">What exactly do you want done?</p>
        <Textarea
          placeholder="Define the task clearly..."
          value={config.task}
          onChange={(e) => onUpdate({ task: e.target.value })}
          className="min-h-[100px] bg-background"
          aria-label="Task description"
        />
      </TabsContent>

      <TabsContent value="format" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">How should the answer be structured?</p>
        <div className="flex flex-wrap gap-2">
          {formatOptions.map((format) => (
            <button
              type="button"
              key={format}
              className={cn(
                badgeVariants({
                  variant: config.format.includes(format) ? "default" : "outline",
                }),
                "interactive-chip cursor-pointer select-none"
              )}
              onClick={() => toggleFormat(format)}
              aria-pressed={config.format.includes(format)}
            >
              {format}
            </button>
          ))}
        </div>
        <Input
          placeholder="Custom format..."
          value={config.customFormat}
          onChange={(e) => onUpdate({ customFormat: e.target.value })}
          className="bg-background"
          aria-label="Custom format"
        />
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Length</Label>
          <Select value={config.lengthPreference} onValueChange={(v) => onUpdate({ lengthPreference: v })}>
            <SelectTrigger className="bg-background" aria-label="Length preference">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lengthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TabsContent>

      <TabsContent value="examples" className="space-y-3 mt-4">
        <p className="text-xs text-muted-foreground">Show, don't just tell — provide example inputs/outputs</p>
        <Textarea
          placeholder="Add example inputs and outputs to guide the AI..."
          value={config.examples}
          onChange={(e) => onUpdate({ examples: e.target.value })}
          className="min-h-[120px] bg-background font-mono"
          aria-label="Examples input"
        />
      </TabsContent>

      <TabsContent value="constraints" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">Set boundaries to improve quality</p>
        <div className="space-y-3">
          {constraintOptions.map((constraint) => {
            const constraintInputId = toConstraintInputId(constraint);
            return (
              <div key={constraint} className="flex items-center gap-2">
                <Checkbox
                  id={constraintInputId}
                  checked={config.constraints.includes(constraint)}
                  onCheckedChange={() => toggleConstraint(constraint)}
                />
                <Label htmlFor={constraintInputId} className="text-sm cursor-pointer">
                  {constraint}
                </Label>
              </div>
            );
          })}
        </div>
        <Input
          placeholder="Add custom constraint..."
          value={config.customConstraint}
          onChange={(e) => onUpdate({ customConstraint: e.target.value })}
          className="bg-background"
          aria-label="Custom constraint"
        />
      </TabsContent>
    </Tabs>
  );
}
