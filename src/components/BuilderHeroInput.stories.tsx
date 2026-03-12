import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BuilderHeroInput } from "./BuilderHeroInput";
import type { BuilderSuggestionChip } from "@/lib/builder-inference";

const DEFAULT_PROMPT =
  "Review the prompt builder user interface, compare the visible flows, and summarize the highest-impact UX improvements.";

const longSuggestionChips: BuilderSuggestionChip[] = [
  {
    id: "append-evidence",
    label: "Add evidence requirements",
    description: "What should back the claims?",
    action: {
      type: "append_prompt",
      text: "\nEvidence: [cite sources, use data, include examples]",
    },
  },
  {
    id: "append-comparison-framework",
    label: "Add comparison framework",
    description:
      "Define the baseline, segments, or time periods to compare.",
    action: {
      type: "append_prompt",
      text: "\nComparison framework: [baseline, segments, cohorts, or time periods to compare]",
    },
  },
];

const meta = {
  title: "Builder/BuilderHeroInput",
  component: BuilderHeroInput,
  args: {
    value: DEFAULT_PROMPT,
    phase3Enabled: true,
    suggestionChips: longSuggestionChips,
    detectedIntent: "analysis",
    isInferringSuggestions: false,
    hasInferenceError: false,
    canResetInferred: true,
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof BuilderHeroInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function BuilderHeroInputStory(args: Story["args"]) {
  const [value, setValue] = useState(args?.value ?? DEFAULT_PROMPT);
  const [intentOverride, setIntentOverride] = useState<
    typeof args.intentOverride
  >(args?.intentOverride ?? null);

  if (!args) {
    throw new Error("BuilderHeroInput story requires args.");
  }

  return (
    <div className="max-w-4xl">
      <BuilderHeroInput
        {...args}
        value={value}
        onChange={setValue}
        onClear={() => setValue("")}
        onResetAll={() => {
          setValue(DEFAULT_PROMPT);
          setIntentOverride(null);
        }}
        intentOverride={intentOverride}
        onIntentOverrideChange={setIntentOverride}
      />
    </div>
  );
}

export const LongSuggestions: Story = {
  render: (args) => <BuilderHeroInputStory {...args} />,
};
