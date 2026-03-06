import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "@/components/base/avatar";

const meta = {
  title: "Design System/Avatar",
  component: Avatar,
  args: {
    size: "md",
    initials: "PF",
    alt: "PromptForge avatar",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const Image: Story = {
  args: {
    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%230d9488'/%3E%3Ctext x='50%25' y='54%25' text-anchor='middle' font-size='36' fill='white' font-family='Arial'%3EPF%3C/text%3E%3C/svg%3E",
    initials: undefined,
  },
};

export const OnlineStatus: Story = {
  args: {
    initials: "AL",
    status: "online",
  },
};

export const Verified: Story = {
  args: {
    initials: "VR",
    verified: true,
  },
};
