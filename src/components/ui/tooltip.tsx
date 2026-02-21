import * as React from "react";

import { Tooltip as UuiTooltip } from "@/components/base/tooltip/tooltip";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";
type TooltipAlign = "start" | "center" | "end";

interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
}

interface TooltipProviderContextValue {
  delayDuration?: number;
}

const TooltipProviderContext = React.createContext<TooltipProviderContextValue>({});

const TooltipProvider = ({ children, delayDuration }: TooltipProviderProps) => (
  <TooltipProviderContext.Provider value={{ delayDuration }}>
    {children}
  </TooltipProviderContext.Provider>
);

interface TooltipRootProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  children: React.ReactNode;
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: TooltipSide;
  align?: TooltipAlign;
  sideOffset?: number;
  children?: React.ReactNode;
}

const TooltipTrigger = ({ children }: TooltipTriggerProps) => <>{children}</>;
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>((_props, _ref) => null);
TooltipContent.displayName = "TooltipContent";

const Tooltip = ({ children, defaultOpen, open, onOpenChange }: TooltipRootProps) => {
  const { delayDuration } = React.useContext(TooltipProviderContext);
  const nodes = React.Children.toArray(children);

  const triggerElement = nodes.find(
    (child): child is React.ReactElement<TooltipTriggerProps> =>
      React.isValidElement(child) && child.type === TooltipTrigger,
  );
  const contentElement = nodes.find(
    (child): child is React.ReactElement<TooltipContentProps> =>
      React.isValidElement(child) && child.type === TooltipContent,
  );

  if (!triggerElement) {
    return null;
  }

  const {
    asChild = false,
    children: triggerChildren,
    className: triggerClassName,
    ...triggerProps
  } = triggerElement.props;

  const triggerNode = asChild
    ? React.isValidElement(triggerChildren)
      ? React.cloneElement(triggerChildren, {
          ...triggerProps,
          className: cn(
            (triggerChildren.props as { className?: string }).className,
            triggerClassName,
            (triggerProps as { className?: string }).className,
          ),
        })
      : triggerChildren
    : (
      <button
        type="button"
        className={triggerClassName}
        {...(triggerProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {triggerChildren}
      </button>
      );

  if (!contentElement) {
    return <>{triggerNode}</>;
  }

  const { children: contentChildren, side = "top", align = "center", sideOffset = 4, hidden } = contentElement.props;

  if (hidden || typeof contentChildren === "undefined" || contentChildren === null) {
    return <>{triggerNode}</>;
  }

  const placement = align === "center" ? side : `${side} ${align}`;

  return (
    <UuiTooltip
      title={contentChildren}
      placement={placement as React.ComponentProps<typeof UuiTooltip>["placement"]}
      delay={delayDuration}
      offset={sideOffset}
      defaultOpen={defaultOpen}
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      {triggerNode}
    </UuiTooltip>
  );
};
Tooltip.displayName = "Tooltip";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
