import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { ArrowRight } from "@phosphor-icons/react";

const meta = {
  title: "Design System/Button",
  component: Button,
  args: {
    children: "Primary action",
    size: "sm",
    variant: "primary",
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
    variant: "secondary",
    children: "Secondary action",
  },
};

export const Tertiary: Story = {
  args: {
    variant: "tertiary",
    children: "Tertiary action",
  },
};

export const Destructive: Story = {
  args: {
    variant: "primary",
    tone: "destructive",
    children: "Delete item",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: "Saving",
  },
};

export const IconOnly: Story = {
  args: {
    size: "icon",
    variant: "secondary",
    iconTrailing: ArrowRight,
    children: undefined,
    "aria-label": "Continue",
  },
};
