import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/tabs";

const meta = {
  title: "Design System/Tabs",
  component: Tabs,
  args: {
    defaultValue: "overview",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Tabs {...args} className="w-[420px]">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="rounded-md border border-border bg-card p-3 text-sm">
        Overview details for this preset.
      </TabsContent>
      <TabsContent value="settings" className="rounded-md border border-border bg-card p-3 text-sm">
        Settings controls and defaults.
      </TabsContent>
      <TabsContent value="history" className="rounded-md border border-border bg-card p-3 text-sm">
        Prompt revision history.
      </TabsContent>
    </Tabs>
  ),
};

export const WithDisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[420px]">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="history" disabled>
          History
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="rounded-md border border-border bg-card p-3 text-sm">
        Overview details for this preset.
      </TabsContent>
      <TabsContent value="settings" className="rounded-md border border-border bg-card p-3 text-sm">
        Settings controls and defaults.
      </TabsContent>
      <TabsContent value="history" className="rounded-md border border-border bg-card p-3 text-sm">
        Prompt revision history.
      </TabsContent>
    </Tabs>
  ),
};
