import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextArea } from "@/components/base/textarea";

const meta = {
  title: "Design System/Textarea",
  component: TextArea,
  args: {
    label: "Prompt context",
    placeholder: "Provide constraints, audience, and required output format.",
    rows: 5,
  },
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[320px] sm:w-[460px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InvalidWithHint: Story = {
  args: {
    isInvalid: true,
    hint: "This field is required before publishing.",
    value: "Needs revision",
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    value: "Read-only context",
  },
};
