import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { MagnifyingGlass as Search } from "@phosphor-icons/react";

const meta = {
  title: "Design System/Input",
  component: Input,
  args: {
    label: "Prompt title",
    placeholder: "Enter a concise title",
    size: "sm",
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
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLeadingIcon: Story = {
  args: {
    icon: Search,
    placeholder: "Search prompts",
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    value: "Read-only value",
  },
};

export const InvalidWithHint: Story = {
  args: {
    isInvalid: true,
    value: "bad@@mail",
    label: "Email",
    hint: "Enter a valid email address.",
  },
};
