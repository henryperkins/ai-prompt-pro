import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "@/components/base/checkbox";

const meta = {
  title: "Design System/Checkbox",
  component: Checkbox,
  args: {
    label: "Enable auto-save",
    size: "sm",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: {
    defaultSelected: true,
  },
};

export const WithHint: Story = {
  args: {
    label: "Share with team",
    hint: "Teammates with project access can view this prompt.",
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    defaultSelected: true,
  },
};
