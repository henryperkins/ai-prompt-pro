import type { Meta, StoryObj } from "@storybook/react-vite";
import { ButtonGroup, ButtonGroupItem } from "./button-group";

const DeploymentsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path
      d="M5 4.75H15V8.25H13V10.75H7V8.25H5V4.75ZM8.5 8.25V9.25H11.5V8.25H8.5ZM6.5 12.25H9V15.25H6.5V12.25ZM11 12.25H13.5V15.25H11V12.25Z"
      fill="currentColor"
    />
  </svg>
);

const meta = {
  title: "Design System/Button Group",
  component: ButtonGroup,
  args: {
    size: "md",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function renderButtonGroup(args: Story["args"]) {
  return (
    <ButtonGroup {...args} defaultValue="all" aria-label="Feed filter">
      <ButtonGroupItem value="all" size={args?.size}>All</ButtonGroupItem>
      <ButtonGroupItem value="mentions" size={args?.size}>Mentions</ButtonGroupItem>
      <ButtonGroupItem value="deployments" size={args?.size} iconLeading={DeploymentsIcon}>
        Deployments
      </ButtonGroupItem>
    </ButtonGroup>
  );
}

export const Default: Story = {
  render: renderButtonGroup,
};

export const Compact: Story = {
  render: renderButtonGroup,
  args: {
    size: "sm",
  },
};

export const Large: Story = {
  render: renderButtonGroup,
  args: {
    size: "lg",
  },
};
