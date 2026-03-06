import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, BadgeWithDot, BadgeWithIcon } from "./badges";
import { CheckCircle as CheckCircle2 } from "@phosphor-icons/react";

const meta = {
  title: "Design System/Badge",
  component: Badge,
  args: {
    children: "Status",
    size: "md",
    variant: "pill",
    tone: "default",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gray: Story = {};

export const Brand: Story = {
  args: {
    tone: "brand",
    children: "Featured",
  },
};

export const Error: Story = {
  args: {
    tone: "error",
    children: "Blocked",
  },
};

export const WithDot: Story = {
  render: (args) => (
    <BadgeWithDot {...args}>
      Online
    </BadgeWithDot>
  ),
  args: {
    size: "md",
    variant: "pill",
    tone: "success",
  },
};

export const WithIcon: Story = {
  render: (args) => (
    <BadgeWithIcon {...args} iconLeading={CheckCircle2}>
      Verified
    </BadgeWithIcon>
  ),
  args: {
    size: "md",
    variant: "pill",
    tone: "brand",
  },
};

export const LegacyCompat: Story = {
  args: {
    type: "pill-color",
    color: "brand",
    children: "Legacy props",
  },
};
