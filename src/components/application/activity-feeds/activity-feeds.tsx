import { useState } from "react";
import {
  FileText,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Tag,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/base/badges/badges";
import { BadgeGroup } from "@/components/base/badges/badge-groups";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeedMode = "activity" | "messages";
type FeedLayout = "divided" | "connected" | "spaced";
type ActivityTone = "default" | "success" | "warning" | "error" | "info";

interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  timestamp: string;
  tone: ActivityTone;
  kind: "file" | "invite" | "comment" | "labels";
}

interface MessageEntry {
  id: string;
  actor: string;
  handle: string;
  message: string;
  timestamp: string;
  attachment?: string;
}

const ACTIVITY_ENTRIES: ActivityEntry[] = [
  {
    id: "activity-1",
    actor: "Phoenix Baker",
    action: "added a file to",
    target: "Marketing site redesign",
    detail: "Tech requirements.pdf • 720 KB",
    timestamp: "Just now",
    tone: "info",
    kind: "file",
  },
  {
    id: "activity-2",
    actor: "Lana Steiner",
    action: "was invited to the team by",
    target: "Alina Hester",
    detail: "Workspace access updated.",
    timestamp: "2 mins ago",
    tone: "success",
    kind: "invite",
  },
  {
    id: "activity-3",
    actor: "Candice Wu",
    action: "commented in",
    target: "Marketing site redesign",
    detail: "Can we simplify the onboarding flow copy?",
    timestamp: "3 hours ago",
    tone: "warning",
    kind: "comment",
  },
  {
    id: "activity-4",
    actor: "Natali Craig",
    action: "added labels to",
    target: "Marketing site redesign",
    detail: "Design, Product, Marketing",
    timestamp: "6 hours ago",
    tone: "default",
    kind: "labels",
  },
];

const MESSAGE_ENTRIES: MessageEntry[] = [
  {
    id: "message-1",
    actor: "Phoenix Baker",
    handle: "@phoenix",
    message: "Looks good!",
    timestamp: "Just now",
  },
  {
    id: "message-2",
    actor: "Lana Steiner",
    handle: "@lana",
    message: "Thanks so much, happy with that.",
    timestamp: "2 mins ago",
  },
  {
    id: "message-3",
    actor: "Orlando Diggs",
    handle: "@orlando",
    message: "Shared the draft for review.",
    timestamp: "3:42pm 20 Jan 2025",
    attachment: "Datasheet_draft_02.pdf • 720 KB",
  },
  {
    id: "message-4",
    actor: "Rene Wells",
    handle: "@rene",
    message: "Hey @olivia, just wanted to say thanks for your help on this.",
    timestamp: "9:24am 20 Jan 2025",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function activityIcon(kind: ActivityEntry["kind"]) {
  if (kind === "file") return FileText;
  if (kind === "invite") return UserPlus;
  if (kind === "labels") return Tag;
  return MessageSquare;
}

function activityLabel(kind: ActivityEntry["kind"]) {
  if (kind === "file") return "File";
  if (kind === "invite") return "Invite";
  if (kind === "labels") return "Labels";
  return "Comment";
}

export function ActivityFeedsBlock() {
  const [mode, setMode] = useState<FeedMode>("activity");
  const [layout, setLayout] = useState<FeedLayout>("divided");

  const isActivityMode = mode === "activity";
  const activityEntries = isActivityMode ? ACTIVITY_ENTRIES : [];
  const messageEntries = isActivityMode ? [] : MESSAGE_ENTRIES;
  const entryCount = isActivityMode ? activityEntries.length : messageEntries.length;

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Activity Feeds</h3>
          <BadgeGroup addonText={`${entryCount} items`}>
            {mode === "activity" ? "Activity feed" : "Messages feed"}
          </BadgeGroup>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonGroup
            size="sm"
            value={mode}
            onValueChange={(value) => value && setMode(value as FeedMode)}
            aria-label="Feed mode"
          >
            <ButtonGroupItem value="activity" size="sm">
              Activity
            </ButtonGroupItem>
            <ButtonGroupItem value="messages" size="sm">
              Messages
            </ButtonGroupItem>
          </ButtonGroup>

          <ButtonGroup
            size="sm"
            value={layout}
            onValueChange={(value) => value && setLayout(value as FeedLayout)}
            aria-label="Feed layout"
          >
            <ButtonGroupItem value="divided" size="sm">
              Divided
            </ButtonGroupItem>
            <ButtonGroupItem value="connected" size="sm">
              Connected
            </ButtonGroupItem>
            <ButtonGroupItem value="spaced" size="sm">
              Spaced
            </ButtonGroupItem>
          </ButtonGroup>
        </div>
      </div>

      <ul
        role="list"
        className={cn(
          "relative",
          layout === "divided" && "divide-y divide-border/70",
          layout === "connected" && "before:absolute before:bottom-4 before:left-[2.1rem] before:top-4 before:w-px before:bg-border/70",
          layout === "spaced" && "space-y-3 p-3 sm:p-4",
        )}
      >
        {isActivityMode
          ? activityEntries.map((entry) => {
              const Icon = activityIcon(entry.kind);
              return (
                <li
                  key={entry.id}
                  className={cn(
                    "relative flex gap-3 px-4 py-4 sm:px-5",
                    layout === "spaced" && "rounded-lg border border-border/70 bg-background px-3 py-3.5 sm:px-4",
                  )}
                >
                  {layout === "connected" && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[2.1rem] top-7 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-border bg-background"
                    />
                  )}

                  <Avatar className="h-9 w-9 border border-border/70">
                    <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(entry.actor)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{entry.actor}</span>{" "}
                      <span className="text-muted-foreground">{entry.action}</span>{" "}
                      <span className="font-medium">{entry.target}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge tone={entry.tone} size="sm">
                        {activityLabel(entry.kind)}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        {entry.timestamp}
                      </span>
                    </div>
                  </div>

                  <ButtonUtility
                    icon={MoreHorizontal}
                    size="xs"
                    color="tertiary"
                    tooltip="More actions"
                    aria-label={`Actions for ${entry.target}`}
                  />
                </li>
              );
            })
          : messageEntries.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  "relative flex gap-3 px-4 py-4 sm:px-5",
                  layout === "spaced" && "rounded-lg border border-border/70 bg-background px-3 py-3.5 sm:px-4",
                )}
              >
                {layout === "connected" && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[2.1rem] top-7 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-border bg-background"
                  />
                )}

                <Avatar className="h-9 w-9 border border-border/70">
                  <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                    {initials(entry.actor)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{entry.actor}</span>{" "}
                    <span className="text-muted-foreground">{entry.handle}</span>
                  </p>
                  <p className="mt-1 text-sm text-foreground">{entry.message}</p>

                  {entry.attachment ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" />
                      {entry.attachment}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-start gap-2">
                  <span className="mt-1 text-xs text-muted-foreground">{entry.timestamp}</span>
                  <ButtonUtility
                    icon={MoreHorizontal}
                    size="xs"
                    color="tertiary"
                    tooltip="More actions"
                    aria-label={`Actions for message by ${entry.actor}`}
                  />
                </div>
              </li>
            ))}
      </ul>
    </Card>
  );
}
