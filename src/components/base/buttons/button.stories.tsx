import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { ArrowRight } from "@phosphor-icons/react";

const meta = {
  title: "Design System/Button",
  component: Button,
  args: {
    children: "Primary action",
    size: "sm",
    color: "primary",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    color: "secondary",
    children: "Secondary action",
  },
};

export const Tertiary: Story = {
  args: {
    color: "tertiary",
    children: "Tertiary action",
  },
};

export const Destructive: Story = {
  args: {
    color: "primary-destructive",
    children: "Delete item",
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    children: "Saving",
  },
};

export const IconOnly: Story = {
  args: {
    size: "icon",
    color: "secondary",
    iconTrailing: ArrowRight,
    children: undefined,
    "aria-label": "Continue",
  },
};
