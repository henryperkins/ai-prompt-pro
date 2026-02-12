import { formatDistanceToNow } from "date-fns";
import { ArrowUp, Bell, CheckCircle2, GitBranch, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

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

function getInitials(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
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
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bell className="h-4 w-4" />
          Notifications
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-11 px-3 text-sm sm:h-9 sm:px-2 sm:text-base"
              onClick={onRefresh}
            >
              Refresh
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-11 px-3 text-sm sm:h-9 sm:px-2 sm:text-base"
            onClick={() => void onMarkAllAsRead()}
            disabled={unreadCount === 0 || loading}
          >
            Mark all read
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
        <div className="px-3 py-8 text-center text-xs text-muted-foreground">
          No notifications yet.
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
                      <AvatarFallback className="text-xs">
                        {getInitials(notification.actorDisplayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-background bg-background p-0.5">
                      {getTypeIcon(notification.type)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">
                      <span className="font-medium">{notification.actorDisplayName}</span>{" "}
                      {getTypeLabel(notification.type)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{notification.postTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{createdAgo}</p>
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
                      className="block min-h-11 outline-none"
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
                      className="block min-h-11 w-full text-left"
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
