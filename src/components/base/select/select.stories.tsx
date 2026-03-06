import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./select";

const ITEMS = [
  { id: "gpt-5", label: "GPT-5", supportingText: "Balanced quality and speed" },
  { id: "gpt-5-mini", label: "GPT-5 mini", supportingText: "Fast iteration" },
  { id: "o4-mini", label: "o4-mini", supportingText: "Reasoning-focused" },
  { id: "legacy", label: "Legacy model", supportingText: "Deprecated", isDisabled: true },
];

const meta = {
  title: "Design System/Select",
  component: Select,
  args: {
    label: "Target model",
    placeholder: "Select model",
    items: ITEMS,
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
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

function renderSelect(args: Story["args"]) {
  return (
    <Select {...args}>
      {(item) => (
        <Select.Item
          id={item.id}
          label={item.label}
          supportingText={item.supportingText}
          isDisabled={item.isDisabled}
        />
      )}
    </Select>
  );
}

export const Default: Story = {
  render: renderSelect,
};

export const WithSelection: Story = {
  render: renderSelect,
  args: {
    defaultSelectedKey: "gpt-5-mini",
  },
};

export const InvalidWithHint: Story = {
  render: renderSelect,
  args: {
    isInvalid: true,
    hint: "Select a model before continuing.",
  },
};

export const Disabled: Story = {
  render: renderSelect,
  args: {
    isDisabled: true,
    defaultSelectedKey: "gpt-5",
  },
};
