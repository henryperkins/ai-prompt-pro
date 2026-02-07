import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Target, FileText, Layout, Lightbulb, Shield } from "lucide-react";
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
      <TabsList className="w-full grid grid-cols-3 lg:grid-cols-6 h-auto gap-1 bg-muted/30 p-1">
        <TabsTrigger value="role" className="gap-1 text-xs px-2">
          <User className="w-3 h-3" />
          <span className="hidden sm:inline">Role</span>
        </TabsTrigger>
        <TabsTrigger value="task" className="gap-1 text-xs px-2">
          <Target className="w-3 h-3" />
          <span className="hidden sm:inline">Task</span>
        </TabsTrigger>
        <TabsTrigger value="context" className="gap-1 text-xs px-2">
          <FileText className="w-3 h-3" />
          <span className="hidden sm:inline">Context</span>
        </TabsTrigger>
        <TabsTrigger value="format" className="gap-1 text-xs px-2">
          <Layout className="w-3 h-3" />
          <span className="hidden sm:inline">Format</span>
        </TabsTrigger>
        <TabsTrigger value="examples" className="gap-1 text-xs px-2">
          <Lightbulb className="w-3 h-3" />
          <span className="hidden sm:inline">Examples</span>
        </TabsTrigger>
        <TabsTrigger value="constraints" className="gap-1 text-xs px-2">
          <Shield className="w-3 h-3" />
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

      <TabsContent value="context" className="space-y-3 mt-4">
        <p className="text-xs text-muted-foreground">Provide key data or background the model needs</p>
        <Textarea
          placeholder="Add relevant background information, data, or references..."
          value={config.context}
          onChange={(e) => onUpdate({ context: e.target.value })}
          className="min-h-[100px] bg-background"
          aria-label="Context input"
        />
      </TabsContent>

      <TabsContent value="format" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">How should the answer be structured?</p>
        <div className="flex flex-wrap gap-2">
          {formatOptions.map((format) => (
            <Badge
              key={format}
              variant={config.format.includes(format) ? "default" : "outline"}
              className="cursor-pointer select-none transition-all"
              onClick={() => toggleFormat(format)}
            >
              {format}
            </Badge>
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
          className="min-h-[120px] bg-background font-mono text-sm"
          aria-label="Examples input"
        />
      </TabsContent>

      <TabsContent value="constraints" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">Set boundaries to improve quality</p>
        <div className="space-y-3">
          {constraintOptions.map((constraint) => (
            <div key={constraint} className="flex items-center gap-2">
              <Checkbox
                id={constraint}
                checked={config.constraints.includes(constraint)}
                onCheckedChange={() => toggleConstraint(constraint)}
              />
              <Label htmlFor={constraint} className="text-sm cursor-pointer">
                {constraint}
              </Label>
            </div>
          ))}
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
