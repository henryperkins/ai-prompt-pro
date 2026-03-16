import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./label";

const meta = {
  title: "Design System/Label",
  component: Label,
  args: {
    children: "Prompt title",
  },
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[320px] sm:w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

function renderLabel(args: Story["args"]) {
  return (
    <div className="grid gap-2">
      <Label {...args} htmlFor="label-story-input" />
      <input
        id="label-story-input"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
        placeholder="Prompt title"
      />
    </div>
  );
}

export const Default: Story = {
  render: renderLabel,
};

export const RequiredWithTooltip: Story = {
  render: renderLabel,
  args: {
    children: "Target model",
    isRequired: true,
    tooltip: "Used to tailor examples and output style.",
  },
};

export const LongLabel: Story = {
  render: renderLabel,
  args: {
    children: "Prompt constraints and required output formatting",
  },
};
