import type { ReactNode } from "react";
import { AlertTriangle, Lock, SearchX, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/base/primitives/card";
import { Button } from "@/components/base/buttons/button";
import { DEFAULT_UI_DENSITY, type UIDensity } from "@/lib/ui-density";
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
  density?: UIDensity;
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
  const isPrimary = variant === "default";
  const actionClassName = isPrimary
    ? "ui-toolbar-button font-semibold shadow-sm"
    : "ui-toolbar-button font-medium";
  if (action.to) {
    return (
      <Button asChild size="sm" variant={variant} className={actionClassName}>
        <Link to={action.to}>{action.label}</Link>
      </Button>
    );
  }

  return (
    <Button type="button" size="sm" variant={variant} className={actionClassName} onClick={action.onClick}>
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
  density = DEFAULT_UI_DENSITY,
  className,
  icon,
}: StateCardProps) {
  const meta = variantMeta[variant];
  const Icon = meta.icon;

  return (
    <Card className={cn("ui-density space-y-4 p-4 sm:p-5", meta.cardClassName, className)} data-density={density}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/80",
            meta.iconClassName,
          )}
        >
          {icon ?? <Icon className="h-4 w-4" />}
        </span>
        <div className="space-y-1">
          <p className="ui-state-card-title text-foreground">{title}</p>
          <p className="ui-state-card-body text-muted-foreground">{description}</p>
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
