import { useMemo, useState } from "react";
import { Badge } from "@/components/base/badges/badges";
import { BadgeGroup } from "@/components/base/badges/badge-groups";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Avatar, AvatarFallback } from "@/components/base/primitives/avatar";
import { Card } from "@/components/base/primitives/card";
import { cn } from "@/lib/utils";
import {
  Bell,
  Chat as MessageSquare,
  DotsThreeOutline as MoreHorizontal,
  GitPullRequest,
  Heart,
  Rocket,
} from "@phosphor-icons/react";

type FeedFilter = "all" | "mentions" | "deployments";

interface FeedItem {
  id: string;
  type: FeedFilter;
  actor: string;
  action: string;
  target: string;
  summary: string;
  timestamp: string;
  tone: "default" | "success" | "warning" | "error" | "info";
}

const FEED_ITEMS: FeedItem[] = [
  {
    id: "1",
    type: "deployments",
    actor: "Ava Chen",
    action: "deployed",
    target: "Community Feed v2",
    summary: "Production rollout completed with no errors.",
    timestamp: "2m ago",
    tone: "success",
  },
  {
    id: "2",
    type: "mentions",
    actor: "Mika Rivera",
    action: "mentioned you in",
    target: "Prompt quality follow-up",
    summary: "Can you review the suggested prompt scoring rules?",
    timestamp: "14m ago",
    tone: "info",
  },
  {
    id: "3",
    type: "all",
    actor: "Jordan Wu",
    action: "opened",
    target: "PR #482",
    summary: "Refactor community voting aggregation and tests.",
    timestamp: "33m ago",
    tone: "warning",
  },
  {
    id: "4",
    type: "all",
    actor: "Sara Kim",
    action: "reacted to",
    target: "Feed fallback copy",
    summary: "Left positive feedback on the empty-state text.",
    timestamp: "1h ago",
    tone: "default",
  },
];

function itemIcon(type: FeedFilter) {
  if (type === "mentions") {
    return MessageSquare;
  }

  if (type === "deployments") {
    return Rocket;
  }

  return Bell;
}

function itemInitials(actor: string) {
  return actor
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toneLabel(tone: FeedItem["tone"]) {
  if (tone === "success") return "Healthy";
  if (tone === "warning") return "Needs review";
  if (tone === "error") return "Blocked";
  if (tone === "info") return "Update";
  return "Note";
}

export function FeedListBlock() {
  const [filter, setFilter] = useState<FeedFilter>("all");

  const visibleItems = useMemo(() => {
    if (filter === "all") {
      return FEED_ITEMS;
    }

    return FEED_ITEMS.filter((item) => item.type === filter);
  }, [filter]);

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Activity Feed</h3>
          <BadgeGroup addonText={`${visibleItems.length} items`}>Last 24 hours</BadgeGroup>
        </div>
        <ButtonGroup value={filter} onValueChange={(value) => value && setFilter(value as FeedFilter)} aria-label="Feed filter">
          <ButtonGroupItem value="all">All</ButtonGroupItem>
          <ButtonGroupItem value="mentions">Mentions</ButtonGroupItem>
          <ButtonGroupItem value="deployments" iconLeading={GitPullRequest}>
            Deployments
          </ButtonGroupItem>
        </ButtonGroup>
      </div>

      <ul role="list" className="divide-y divide-border/70">
        {visibleItems.map((item) => {
          const Icon = itemIcon(item.type);
          return (
            <li key={item.id} className="flex gap-3 px-4 py-4 sm:px-5">
              <Avatar className="h-9 w-9 border border-border/70">
                <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                  {itemInitials(item.actor)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{item.actor}</span>{" "}
                  <span className="text-muted-foreground">{item.action}</span>{" "}
                  <span className="font-medium text-foreground">{item.target}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={item.tone} size="sm">
                    {toneLabel(item.tone)}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {item.type === "mentions" ? "Mention" : item.type === "deployments" ? "Deployment" : "Notification"}
                  </span>
                </div>
              </div>

              <div className={cn("flex shrink-0 items-start gap-2", "text-xs text-muted-foreground")}>
                <span className="mt-1">{item.timestamp}</span>
                <ButtonUtility
                  icon={MoreHorizontal}
                  size="xs"
                  color="tertiary"
                  tooltip="More actions"
                  aria-label={`Actions for ${item.target}`}
                />
                <ButtonUtility icon={Heart} size="xs" color="tertiary" tooltip="Save" aria-label={`Save ${item.target}`} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
