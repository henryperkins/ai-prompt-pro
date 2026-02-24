import { useMemo, useState } from "react";
import { Badge } from "@/components/base/badges/badges";
import { BadgeGroup } from "@/components/base/badges/badge-groups";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { ActivityFeedsBlock } from "@/components/application/activity-feeds/activity-feeds";
import { CodeSnippetTabs } from "@/components/application/code-snippet/code-snippet";
import { FeedListBlock } from "@/components/application/lists/feed-list";
import { ProgressSteps, type ProgressStepItem } from "@/components/application/progress-steps/progress-steps";
import { TeamMembersTableBlock } from "@/components/application/tables/team-members-table";
import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";
import { ProgressBarCircle, ProgressBarHalfCircle } from "@/components/base/progress-indicators/progress-circles";
import { PageHero, PageShell } from "@/components/PageShell";
import { Card } from "@/components/base/primitives/card";
import { ArrowCounterClockwise as RotateCcw, Minus, Plus } from "@phosphor-icons/react";

const SNIPPETS = [
  {
    id: "tsx",
    label: "React",
    language: "tsx",
    fileName: "components/upload-status.tsx",
    code: `import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";

export function UploadStatus({ value }: { value: number }) {
  return <ProgressBar value={value} labelPosition="right" />;
}`,
  },
  {
    id: "bash",
    label: "CLI",
    language: "bash",
    fileName: "commands.sh",
    code: `npx untitledui@latest add progress-indicators progress-circles progress-steps
npx untitledui@latest add code-snippet activity-feed table
npx untitledui@latest add button-utility badges badge-groups button-group`,
  },
];

const BASE_STEPS: ProgressStepItem[] = [
  { id: "draft", title: "Draft", description: "Structure content", status: "complete" },
  { id: "review", title: "Review", description: "Validate changes", status: "current" },
  { id: "ship", title: "Ship", description: "Deploy to production", status: "upcoming" },
];

const ComponentsShowcase = () => {
  const [progressValue, setProgressValue] = useState(58);
  const [stepMode, setStepMode] = useState<"icons" | "numbers">("icons");

  const steps = useMemo(() => BASE_STEPS, []);

  const incrementProgress = () => setProgressValue((value) => Math.min(100, value + 10));
  const decrementProgress = () => setProgressValue((value) => Math.max(0, value - 10));
  const resetProgress = () => setProgressValue(58);

  return (
    <PageShell>
      <PageHero
        eyebrow="Untitled UI Integration"
        title="Untitled UI Component Showcase"
        subtitle="Progress indicators, progress steps, activity feeds, tables, code snippets, utility buttons, badges, and button groups implemented in the active design system."
      />

      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="space-y-5 border-border/80 bg-card/90 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Progress Indicators</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge type="modern">Linear + Circular</Badge>
                <BadgeGroup addonText="Live value">{progressValue}%</BadgeGroup>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ButtonUtility icon={Minus} tooltip="Decrease progress" onClick={decrementProgress} />
              <ButtonUtility icon={Plus} tooltip="Increase progress" onClick={incrementProgress} />
              <ButtonUtility icon={RotateCcw} tooltip="Reset progress" onClick={resetProgress} color="tertiary" />
            </div>
          </div>

          <div className="space-y-5">
            <ProgressBar value={progressValue} labelPosition="right" />
            <ProgressBar value={Math.max(0, progressValue - 12)} labelPosition="bottom" />
            <ProgressBar value={Math.min(100, progressValue + 8)} labelPosition="top-floating" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-4">
                <ProgressBarCircle value={progressValue} size="xs" label="Upload" />
              </div>
              <div className="rounded-lg border border-border/70 p-4">
                <ProgressBarHalfCircle value={progressValue} size="md" label="Deploy" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 border-border/80 bg-card/90 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Progress Steps</h2>
            <ButtonGroup value={stepMode} onValueChange={(value) => value && setStepMode(value as "icons" | "numbers")} aria-label="Progress step mode">
              <ButtonGroupItem value="icons">Icons</ButtonGroupItem>
              <ButtonGroupItem value="numbers">Numbers</ButtonGroupItem>
            </ButtonGroup>
          </div>
          <ProgressSteps steps={steps} showNumbers={stepMode === "numbers"} />
        </Card>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Feed List Block</h2>
          <FeedListBlock />
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Activity Feeds</h2>
          <ActivityFeedsBlock />
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Tables</h2>
          <TeamMembersTableBlock />
        </div>

        <Card className="space-y-4 border-border/80 bg-card/90 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground">Code Snippets</h2>
          <CodeSnippetTabs tabs={SNIPPETS} defaultTabId="tsx" />
        </Card>
      </div>
    </PageShell>
  );
};

export default ComponentsShowcase;
