import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, BadgeWithDot, BadgeWithIcon } from "./badges";
import { CheckCircle as CheckCircle2 } from "@phosphor-icons/react";

const meta = {
  title: "Design System/Badge",
  component: Badge,
  args: {
    children: "Status",
    size: "md",
    type: "pill-color",
    color: "gray",
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
    color: "brand",
    children: "Featured",
  },
};

export const Error: Story = {
  args: {
    color: "error",
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
    type: "pill-color",
    color: "success",
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
    type: "pill-color",
    color: "brand",
  },
};
