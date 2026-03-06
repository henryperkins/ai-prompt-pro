import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/base/buttons/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/base/drawer";

const meta = {
  title: "Design System/Drawer",
  component: Drawer,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: () => (
    <Drawer open>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Mobile filters</DrawerTitle>
          <DrawerDescription>Refine results by model family, domain, and complexity.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button variant="secondary">Reset</Button>
          <Button variant="primary">Apply filters</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

export const Triggered: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Quick actions</DrawerTitle>
          <DrawerDescription>Pick a frequently used action without leaving the current screen.</DrawerDescription>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  ),
};
