import type { AnchorHTMLAttributes, ButtonHTMLAttributes, DetailedHTMLProps } from "react";
import { cva } from "class-variance-authority";
import type { ButtonProps as AriaButtonProps, LinkProps as AriaLinkProps } from "react-aria-components";
import { Button as AriaButton, Link as AriaLink } from "react-aria-components";
import { cx, sortCx } from "@/lib/utils/cx";
import { renderIconSlot, type IconSlot } from "@/lib/utils/icon-slot";

const legacyButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:text-sm [&_svg]:pointer-events-none [&_svg]:h-[1em] [&_svg]:w-[1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:brightness-95",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:brightness-95",
        brandPrimary:
          "border border-primary/30 text-primary-foreground bg-[linear-gradient(135deg,hsl(var(--delight-warm)),hsl(var(--delight-cool)))] shadow-[0_14px_30px_-20px_hsl(var(--delight-glow)/0.72)] hover:brightness-105",
        brandSecondary: "border border-secondary bg-primary text-secondary shadow-xs hover:brightness-95",
        brandDestructive:
          "border border-destructive/30 text-destructive-foreground bg-[linear-gradient(135deg,hsl(var(--destructive)),hsl(0_70%_42%))] shadow-[0_12px_24px_-18px_hsl(var(--destructive)/0.8)] hover:brightness-105",
        outline: "border border-secondary bg-primary text-secondary shadow-xs hover:brightness-95",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:brightness-95",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "justify-start rounded p-0 text-primary underline-offset-4 hover:text-primary/90 hover:underline",
        glow:
          "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:brightness-95 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)] motion-safe:hover:-translate-y-[1px] motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]",
        soft: "border border-primary/20 bg-secondary text-secondary-foreground hover:brightness-95",
      },
      size: {
        default: "h-11 px-4 py-2 sm:h-10",
        sm: "h-11 rounded-md px-3 sm:h-9",
        lg: "h-12 rounded-md px-8 sm:h-11",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export const buttonVariants = legacyButtonVariants;

export const styles = sortCx({
  common: {
    root: [
      "group relative inline-flex h-max cursor-pointer items-center justify-center whitespace-nowrap rounded-lg transition duration-100 ease-linear",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "in-data-input-wrapper:focus:!z-50 in-data-input-wrapper:in-data-leading:-mr-px in-data-input-wrapper:in-data-leading:rounded-r-none",
      "in-data-input-wrapper:in-data-trailing:-ml-px in-data-input-wrapper:in-data-trailing:rounded-l-none",
      "*:data-icon:pointer-events-none *:data-icon:shrink-0",
    ].join(" "),
    icon: "size-5 transition-inherit-all",
  },
  sizes: {
    sm: {
      root: "gap-1 rounded-lg px-3 py-2 text-sm font-semibold data-icon-only:size-11 data-icon-only:p-0",
      linkRoot: "gap-1",
    },
    md: {
      root: "gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold data-icon-only:size-11 data-icon-only:p-0",
      linkRoot: "gap-1.5",
    },
    lg: {
      root: "gap-1.5 rounded-lg px-4 py-2.5 text-base font-semibold data-icon-only:size-12 data-icon-only:p-0",
      linkRoot: "gap-1.5",
    },
    xl: {
      root: "gap-2 rounded-lg px-4.5 py-3 text-base font-semibold data-icon-only:size-12 data-icon-only:p-0",
      linkRoot: "gap-2",
    },
    icon: {
      root: "size-11 p-0 text-sm",
      linkRoot: "",
    },
  },
  colors: {
    primary: {
      root: "bg-primary text-primary-foreground shadow-xs hover:brightness-95 data-loading:brightness-95",
    },
    secondary: {
      root: "border border-border bg-background text-foreground shadow-xs hover:bg-muted data-loading:bg-muted",
    },
    tertiary: {
      root: "text-muted-foreground hover:bg-muted hover:text-foreground data-loading:bg-muted",
    },
    "link-gray": {
      root: [
        "justify-normal rounded p-0 text-muted-foreground hover:text-foreground",
        "*:data-text:underline *:data-text:decoration-transparent *:data-text:underline-offset-2 hover:*:data-text:decoration-current",
      ].join(" "),
    },
    "link-color": {
      root: [
        "justify-normal rounded p-0 text-primary hover:text-primary/90",
        "*:data-text:underline *:data-text:decoration-transparent *:data-text:underline-offset-2 hover:*:data-text:decoration-current",
      ].join(" "),
    },
    "primary-destructive": {
      root: "bg-destructive text-destructive-foreground shadow-xs hover:brightness-95 data-loading:brightness-95",
    },
    "secondary-destructive": {
      root: "border border-destructive/35 bg-background text-destructive shadow-xs hover:bg-destructive/10 data-loading:bg-destructive/10",
    },
    "tertiary-destructive": {
      root: "text-destructive hover:bg-destructive/10 data-loading:bg-destructive/10",
    },
    "link-destructive": {
      root: [
        "justify-normal rounded p-0 text-destructive hover:text-destructive/90",
        "*:data-text:underline *:data-text:decoration-transparent *:data-text:underline-offset-2 hover:*:data-text:decoration-current",
      ].join(" "),
    },
  },
});

type ButtonSize = keyof typeof styles.sizes | "default";
type ButtonIconProps = { className?: string; "data-icon"?: string };

/**
 * Common props shared between button and anchor variants
 */
export interface CommonProps {
  /** Disables the button and shows a disabled state */
  isDisabled?: boolean;
  /** Shows a loading spinner and disables the button */
  isLoading?: boolean;
  /** The size variant of the button */
  size?: ButtonSize;
  /** The color variant of the button */
  color?: keyof typeof styles.colors;
  /** Icon component or element to show before the text */
  iconLeading?: IconSlot<ButtonIconProps>;
  /** Icon component or element to show after the text */
  iconTrailing?: IconSlot<ButtonIconProps>;
  /** Removes horizontal padding from the text content */
  noTextPadding?: boolean;
  /** When true, keeps the text visible during loading state */
  showTextWhileLoading?: boolean;
}

/**
 * Props for the button variant (non-link)
 */
export interface ButtonProps extends CommonProps, DetailedHTMLProps<Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "slot">, HTMLButtonElement> {
  /** Slot name for react-aria component */
  slot?: AriaButtonProps["slot"];
}

/**
 * Props for the link variant (anchor tag)
 */
interface LinkProps extends CommonProps, DetailedHTMLProps<Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "color">, HTMLAnchorElement> {
  /** Options for the configured client side router. */
  routerOptions?: AriaLinkProps["routerOptions"];
}

/** Union type of button and link props */
export type Props = ButtonProps | LinkProps;

export const Button = ({
  size = "sm",
  color = "primary",
  children,
  className,
  noTextPadding,
  iconLeading: IconLeading,
  iconTrailing: IconTrailing,
  isDisabled: disabled,
  isLoading: loading,
  showTextWhileLoading,
  ...otherProps
}: Props) => {
  const resolvedSize = size === "default" ? "sm" : size;
  const href = "href" in otherProps ? otherProps.href : undefined;
  const Component = href ? AriaLink : AriaButton;

  const isIcon = (IconLeading || IconTrailing) && !children;
  const isLinkType = ["link-gray", "link-color", "link-destructive"].includes(color);
  const disabledState = Boolean(disabled || ("disabled" in otherProps && otherProps.disabled));

  noTextPadding = isLinkType || noTextPadding;

  let props = {};

  if (href) {
    props = {
      ...otherProps,
      href: disabledState ? undefined : href,
    };
  } else {
    props = {
      ...otherProps,
      type: (otherProps as ButtonHTMLAttributes<HTMLButtonElement>).type || "button",
      isPending: loading,
    };
  }

  return (
    <Component
      data-loading={loading ? true : undefined}
      data-icon-only={isIcon ? true : undefined}
      {...props}
      isDisabled={disabledState}
      className={cx(
        styles.common.root,
        styles.sizes[resolvedSize].root,
        styles.colors[color].root,
        isLinkType && styles.sizes[resolvedSize].linkRoot,
        (loading || (href && (disabledState || loading))) && "pointer-events-none",
        loading && (showTextWhileLoading ? "[&>*:not([data-icon=loading]):not([data-text])]:hidden" : "[&>*:not([data-icon=loading])]:invisible"),
        className,
      )}
    >
      {/* Leading icon */}
      {renderIconSlot(IconLeading, { "data-icon": "leading", className: styles.common.icon })}

      {loading && (
        <svg
          fill="none"
          data-icon="loading"
          viewBox="0 0 20 20"
          className={cx(styles.common.icon, !showTextWhileLoading && "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2")}
        >
          <circle className="stroke-current opacity-30" cx="10" cy="10" r="8" fill="none" strokeWidth="2" />
          <circle
            className="origin-center animate-spin stroke-current"
            cx="10"
            cy="10"
            r="8"
            fill="none"
            strokeWidth="2"
            strokeDasharray="12.5 50"
            strokeLinecap="round"
          />
        </svg>
      )}

      {children && (
        <span data-text className={cx("transition-inherit-all", !noTextPadding && "px-0.5")}>
          {children}
        </span>
      )}

      {/* Trailing icon */}
      {renderIconSlot(IconTrailing, { "data-icon": "trailing", className: styles.common.icon })}
    </Component>
  );
};
