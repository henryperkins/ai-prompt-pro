import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHero, PageShell } from "@/components/PageShell";
import { Badge } from "@/components/base/primitives/badge";
import { Button } from "@/components/base/primitives/button";
import { Card } from "@/components/base/primitives/card";
import { useAuth } from "@/hooks/useAuth";
import {
  isSupportReviewer,
  listContactMessagesForReviewer,
  updateContactMessageStatus,
  type ContactMessageRecord,
  type ContactMessageStatus,
} from "@/lib/contact-support";
import { useToast } from "@/hooks/use-toast";

type AccessState = "loading" | "signed_out" | "forbidden" | "granted";

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusBadgeVariant(status: ContactMessageStatus): "default" | "secondary" | "outline" {
  if (status === "resolved") return "secondary";
  if (status === "reviewing") return "default";
  return "outline";
}

const SupportInbox = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [access, setAccess] = useState<AccessState>("loading");
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const rows = await listContactMessagesForReviewer();
      setMessages(rows);
    } catch (error) {
      toast({
        title: "Could not load inbox",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

  useEffect(() => {
    if (loading) return;
    if (!user?.id) {
      setAccess("signed_out");
      setMessages([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      setAccess("loading");
      try {
        const allowed = await isSupportReviewer();
        if (cancelled) return;
        if (!allowed) {
          setAccess("forbidden");
          setMessages([]);
          return;
        }
        setAccess("granted");
      } catch (error) {
        if (cancelled) return;
        setAccess("forbidden");
        toast({
          title: "Access check failed",
          description: error instanceof Error ? error.message : "Could not verify reviewer access.",
          variant: "destructive",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, toast]);

  useEffect(() => {
    if (access !== "granted") return;
    void loadMessages();
  }, [access, loadMessages]);

  const emptyState = useMemo(() => {
    if (loadingMessages) return "Loading support messages...";
    return "No contact messages yet.";
  }, [loadingMessages]);

  const handleStatusChange = useCallback(async (messageId: string, status: ContactMessageStatus) => {
    setStatusBusyId(messageId);
    try {
      await updateContactMessageStatus(messageId, status);
      setMessages((previous) =>
        previous.map((message) =>
          message.id === messageId
            ? { ...message, status, updatedAt: new Date().toISOString() }
            : message,
        ),
      );
    } catch (error) {
      toast({
        title: "Could not update status",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStatusBusyId(null);
    }
  }, [toast]);

  return (
    <PageShell>
      <PageHero
        title="Support Inbox"
        subtitle="Review and triage contact form submissions."
      />

      {access === "loading" && (
        <Card className="border-border/80 bg-card/85 p-4 text-sm text-muted-foreground">
          Verifying access...
        </Card>
      )}

      {access === "signed_out" && (
        <Card className="border-border/80 bg-card/85 p-4 text-sm text-muted-foreground">
          Sign in with a support reviewer account to access this inbox.
        </Card>
      )}

      {access === "forbidden" && (
        <Card className="border-border/80 bg-card/85 p-4 text-sm text-muted-foreground">
          This account does not have support inbox access.
        </Card>
      )}

      {access === "granted" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadMessages()}
              disabled={loadingMessages}
            >
              {loadingMessages ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {messages.length === 0 && (
            <Card className="border-border/80 bg-card/85 p-4 text-sm text-muted-foreground">
              {emptyState}
            </Card>
          )}

          {messages.map((message) => (
            <Card key={message.id} className="space-y-3 border-border/80 bg-card/85 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {message.firstName} {message.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {message.email}
                    {message.phoneNumber ? ` • ${message.phoneNumber}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {formatCreatedAt(message.createdAt)}
                  </p>
                </div>
                <Badge variant={statusBadgeVariant(message.status)}>
                  {message.status}
                </Badge>
              </div>

              <p className="whitespace-pre-wrap text-sm text-foreground">
                {message.message}
              </p>

              <div className="flex flex-wrap gap-2">
                {(["new", "reviewing", "resolved"] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant={message.status === status ? "secondary" : "outline"}
                    disabled={statusBusyId === message.id || message.status === status}
                    onClick={() => void handleStatusChange(message.id, status)}
                  >
                    Mark {status}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default SupportInbox;
