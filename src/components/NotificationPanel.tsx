import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/base/primitives/avatar";
import { Button } from "@/components/base/buttons/button";
import { ScrollArea } from "@/components/base/primitives/scroll-area";
import { Skeleton } from "@/components/base/primitives/skeleton";
import { getInitials } from "@/lib/community-utils";
import type { Notification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Bell,
  ChatCircle as MessageCircle,
  CheckCircle as CheckCircle2,
  GitBranch,
} from "@phosphor-icons/react";

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  onMarkAsRead: (notificationId: string) => Promise<void> | void;
  onMarkAllAsRead: () => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  onNavigate?: () => void;
  className?: string;
}


function getTypeIcon(type: Notification["type"]) {
  if (type === "upvote") return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
  if (type === "verified") return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
  if (type === "remix") return <GitBranch className="h-3.5 w-3.5 text-primary" />;
  return <MessageCircle className="h-3.5 w-3.5 text-primary" />;
}

function getTypeLabel(type: Notification["type"]): string {
  if (type === "upvote") return "upvoted your post";
  if (type === "verified") return "verified your post";
  if (type === "remix") return "remixed your post";
  return "commented on your post";
}

export function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  onRefresh,
  onNavigate,
  className,
}: NotificationPanelProps) {
  return (
    <div className={cn("w-[min(96vw,24rem)] rounded-md border border-border/80 bg-popover", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className="type-post-title flex items-center gap-2 text-foreground">
          <Bell className="h-4 w-4" />
          Notifications
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              type="button"
              size="sm"
              color="tertiary"
              className="type-button-label h-11 px-3 sm:h-9 sm:px-2"
              onClick={onRefresh}
            >
              Refresh
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            color="tertiary"
            className="type-button-label h-11 px-3 sm:h-9 sm:px-2"
            onClick={() => void onMarkAllAsRead()}
            disabled={unreadCount === 0 || loading}
          >
            Mark all as read
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2 p-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="px-3 py-8 text-center">
          <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground">
            <Bell className="h-4 w-4" />
          </span>
          <p className="type-post-title mt-2 text-foreground">No notifications yet</p>
          <p className="type-help mt-1 text-muted-foreground">
            You'll be notified when others interact with your prompts.
          </p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <ScrollArea className="max-h-[65vh] sm:max-h-[22rem]">
          <div className="space-y-1 p-1.5">
            {notifications.map((notification) => {
              const createdAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
              const itemContent = (
                <div className="flex items-start gap-2.5">
                  <div className="relative mt-0.5">
                    <Avatar className="h-8 w-8 border border-border/60">
                      <AvatarImage
                        src={notification.actorAvatarUrl ?? undefined}
                        alt={notification.actorDisplayName}
                      />
                      <AvatarFallback className="type-reply-label">
                        {getInitials(notification.actorDisplayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-background bg-background p-0.5">
                      {getTypeIcon(notification.type)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="type-post-body text-foreground">
                      <span className="type-post-title">{notification.actorDisplayName}</span>{" "}
                      {getTypeLabel(notification.type)}
                    </p>
                    <p className="type-post-body type-wrap-safe line-clamp-2 text-muted-foreground">{notification.postTitle}</p>
                    <p className="type-timestamp mt-1 text-muted-foreground">{createdAgo}</p>
                  </div>
                </div>
              );

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "rounded-md border px-2.5 py-2.5 text-left transition-colors",
                    notification.readAt
                      ? "border-transparent bg-transparent hover:bg-accent/40"
                      : "border-primary/20 bg-primary/10",
                  )}
                >
                  {notification.postId ? (
                    <Link
                      to={`/community/${notification.postId}`}
                      className="block min-h-11 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => {
                        void onMarkAsRead(notification.id);
                        onNavigate?.();
                      }}
                    >
                      {itemContent}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="block min-h-11 w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => {
                        void onMarkAsRead(notification.id);
                      }}
                    >
                      {itemContent}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
