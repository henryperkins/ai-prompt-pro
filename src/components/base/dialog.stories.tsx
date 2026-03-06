import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/base/buttons/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/base/dialog";

const meta = {
  title: "Design System/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: () => (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish prompt</DialogTitle>
          <DialogDescription>Choose whether to make this prompt visible to the community feed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button variant="primary">Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Triggered: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prompt details</DialogTitle>
          <DialogDescription>Use this space to review and confirm the latest prompt metadata.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};
