import type { Meta, StoryObj } from "@storybook/react-vite";
import { ButtonUtility } from "./button-utility";

const MoreActionsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <circle cx="4" cy="10" r="1.5" fill="currentColor" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    <circle cx="16" cy="10" r="1.5" fill="currentColor" />
  </svg>
);

const SaveIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path
      d="M10 16.25L4.375 10.625C3.625 9.875 3.625 8.625 4.375 7.875C5.125 7.125 6.375 7.125 7.125 7.875L10 10.75L12.875 7.875C13.625 7.125 14.875 7.125 15.625 7.875C16.375 8.625 16.375 9.875 15.625 10.625L10 16.25Z"
      fill="currentColor"
    />
  </svg>
);

const meta = {
  title: "Design System/Button Utility",
  component: ButtonUtility,
  args: {
    icon: MoreActionsIcon,
    tooltip: "More actions",
    "aria-label": "More actions",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof ButtonUtility>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {};

export const TertiaryXs: Story = {
  args: {
    icon: SaveIcon,
    size: "xs",
    color: "tertiary",
    tooltip: "Save",
    "aria-label": "Save",
  },
};

export const DisabledLink: Story = {
  args: {
    href: "#details",
    isDisabled: true,
    tooltip: "Open details",
    "aria-label": "Open details",
  },
};
