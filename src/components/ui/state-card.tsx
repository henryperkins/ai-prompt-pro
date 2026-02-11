import type { ReactNode } from "react";
import { AlertTriangle, Lock, SearchX, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StateCardVariant = "empty" | "error" | "auth";

interface StateCardAction {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

interface StateCardProps {
  variant?: StateCardVariant;
  title: string;
  description: string;
  primaryAction?: StateCardAction;
  secondaryAction?: StateCardAction;
  className?: string;
  icon?: ReactNode;
}

const variantMeta: Record<
  StateCardVariant,
  { icon: LucideIcon; cardClassName: string; iconClassName: string }
> = {
  empty: {
    icon: SearchX,
    cardClassName: "border-border/80 bg-muted/25",
    iconClassName: "text-muted-foreground",
  },
  error: {
    icon: AlertTriangle,
    cardClassName: "border-destructive/30 bg-destructive/5",
    iconClassName: "text-destructive",
  },
  auth: {
    icon: Lock,
    cardClassName: "border-primary/30 bg-primary/5",
    iconClassName: "text-primary",
  },
};

function renderAction(action: StateCardAction, fallbackVariant: StateCardAction["variant"]) {
  const variant = action.variant ?? fallbackVariant;
  if (action.to) {
    return (
      <Button asChild size="sm" variant={variant} className="h-8 text-xs">
        <Link to={action.to}>{action.label}</Link>
      </Button>
    );
  }

  return (
    <Button type="button" size="sm" variant={variant} className="h-8 text-xs" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function StateCard({
  variant = "empty",
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  icon,
}: StateCardProps) {
  const meta = variantMeta[variant];
  const Icon = meta.icon;

  return (
    <Card className={cn("space-y-3 p-4", meta.cardClassName, className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/80",
            meta.iconClassName,
          )}
        >
          {icon ?? <Icon className="h-4 w-4" />}
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap gap-2">
          {primaryAction && renderAction(primaryAction, "default")}
          {secondaryAction && renderAction(secondaryAction, "outline")}
        </div>
      )}
    </Card>
  );
}
