import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BuilderAdjustDetails } from "./BuilderAdjustDetails";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";

const LONG_CUSTOM_ROLE =
  "Senior UX auditor and design systems strategist for AI-assisted product experiences";

const BASE_CONFIG: PromptConfig = {
  ...defaultConfig,
  customRole: LONG_CUSTOM_ROLE,
  tone: "Professional",
  format: ["Report"],
  constraints: ["Avoid jargon"],
};

const meta = {
  title: "Builder/BuilderAdjustDetails",
  component: BuilderAdjustDetails,
  args: {
    config: BASE_CONFIG,
    isOpen: false,
    fieldOwnership: {
      role: "ai",
      tone: "user",
      lengthPreference: "empty",
      format: "user",
      constraints: "user",
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof BuilderAdjustDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

function BuilderAdjustDetailsStory(
  args: Story["args"] & {
    config: PromptConfig;
    isOpen: boolean;
  },
) {
  const [config, setConfig] = useState(args.config);
  const [isOpen, setIsOpen] = useState(args.isOpen);

  return (
    <div className="max-w-3xl">
      <BuilderAdjustDetails
        {...args}
        config={config}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onUpdate={(updates) =>
          setConfig((current) => ({
            ...current,
            ...updates,
          }))
        }
      />
    </div>
  );
}

export const CollapsedLongCustomRole: Story = {
  render: (args) => {
    if (!args?.config) {
      throw new Error("BuilderAdjustDetails story requires config args.");
    }

    return (
      <BuilderAdjustDetailsStory
        {...args}
        config={args.config}
        isOpen={false}
      />
    );
  },
};

export const ExpandedLongCustomRole: Story = {
  render: (args) => {
    if (!args?.config) {
      throw new Error("BuilderAdjustDetails story requires config args.");
    }

    return (
      <BuilderAdjustDetailsStory
        {...args}
        config={args.config}
        isOpen
      />
    );
  },
};
