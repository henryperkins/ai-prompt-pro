import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/tabs";
import { Input } from "@/components/base/input/input";
import { Textarea } from "@/components/base/textarea";
import { Checkbox } from "@/components/base/primitives/checkbox";
import { Label } from "@/components/base/label";
import { Select } from "@/components/base/select/select";
import { cn } from "@/lib/utils";
import { toConstraintInputId } from "@/lib/builder-tabs";
import { Crosshair as Target, Layout, Lightbulb, Shield, User } from "@phosphor-icons/react";
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
        <TabsTrigger value="role" aria-label="Role tab" className="interactive-chip gap-1 px-2 text-xs sm:text-sm">
          <User className="w-3 h-3" />
          <span className="sm:hidden">Role</span>
          <span className="hidden sm:inline">Role</span>
        </TabsTrigger>
        <TabsTrigger value="task" aria-label="Task tab" className="interactive-chip gap-1 px-2 text-xs sm:text-sm">
          <Target className="w-3 h-3" />
          <span className="sm:hidden">Task</span>
          <span className="hidden sm:inline">Task</span>
        </TabsTrigger>
        <TabsTrigger value="format" aria-label="Format tab" className="interactive-chip gap-1 px-2 text-xs sm:text-sm">
          <Layout className="w-3 h-3" />
          <span className="sm:hidden">Fmt</span>
          <span className="hidden sm:inline">Format</span>
        </TabsTrigger>
        <TabsTrigger value="examples" aria-label="Examples tab" className="interactive-chip gap-1 px-2 text-xs sm:text-sm">
          <Lightbulb className="w-3 h-3" />
          <span className="sm:hidden">Ex</span>
          <span className="hidden sm:inline">Examples</span>
        </TabsTrigger>
        <TabsTrigger value="constraints" aria-label="Rules tab" className="interactive-chip gap-1 px-2 text-xs sm:text-sm">
          <Shield className="w-3 h-3" />
          <span className="sm:hidden">Rules</span>
          <span className="hidden sm:inline">Rules</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="role" className="space-y-3 mt-4">
        <p className="text-sm text-muted-foreground">Who should the AI be?</p>
        <Select
          selectedKey={config.role || undefined}
          onSelectionChange={(value) => {
            if (value !== null) {
              onUpdate({ role: String(value) });
            }
          }}
          placeholder="Select a role..."
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
          placeholder="Or type a custom role..."
          value={config.customRole}
          onChange={(value) => onUpdate({ customRole: value })}
          wrapperClassName="bg-background"
          aria-label="Custom role input"
        />
      </TabsContent>

      <TabsContent value="task" className="space-y-3 mt-4">
        <p className="text-sm text-muted-foreground">What exactly do you want done?</p>
        <Textarea
          placeholder="Define the task clearly..."
          value={config.task}
          onChange={(e) => onUpdate({ task: e.target.value })}
          className="min-h-[100px] bg-background"
          aria-label="Task description"
        />
      </TabsContent>

      <TabsContent value="format" className="space-y-4 mt-4">
        <p className="text-sm text-muted-foreground">How should the answer be structured?</p>
        <div className="flex flex-wrap gap-2">
          {formatOptions.map((format) => (
            <button
              type="button"
              key={format}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold transition duration-100 ease-linear focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                config.format.includes(format)
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground",
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
          onChange={(value) => onUpdate({ customFormat: value })}
          wrapperClassName="bg-background"
          aria-label="Custom format"
        />
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Length</Label>
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
            {lengthOptions.map((opt) => (
              <Select.Item key={opt.value} id={opt.value}>
                {opt.label}
              </Select.Item>
            ))}
          </Select>
        </div>
      </TabsContent>

      <TabsContent value="examples" className="space-y-3 mt-4">
        <p className="text-sm text-muted-foreground">Show, don't just tell — provide example inputs/outputs</p>
        <Textarea
          placeholder="Add example inputs and outputs to guide the AI..."
          value={config.examples}
          onChange={(e) => onUpdate({ examples: e.target.value })}
          className="min-h-[120px] bg-background font-mono"
          aria-label="Examples input"
        />
      </TabsContent>

      <TabsContent value="constraints" className="space-y-4 mt-4">
        <p className="text-sm text-muted-foreground">Set boundaries to improve quality</p>
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
          onChange={(value) => onUpdate({ customConstraint: value })}
          wrapperClassName="bg-background"
          aria-label="Custom constraint"
        />
      </TabsContent>
    </Tabs>
  );
}
