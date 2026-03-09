import type { AnchorHTMLAttributes, ButtonHTMLAttributes, DetailedHTMLProps } from "react";
import type { ButtonProps as AriaButtonProps, LinkProps as AriaLinkProps } from "react-aria-components";
import { Button as AriaButton, Link as AriaLink } from "react-aria-components";
import { cx, sortCx } from "@/lib/utils/cx";
import { renderIconSlot, type IconSlot } from "@/lib/utils/icon-slot";
import { buttonVariants as legacyButtonVariants } from "./button-variants";

const styles = sortCx({
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
      root: "bg-primary text-primary-foreground shadow-xs ring-1 ring-inset ring-white/15 hover:brightness-95 data-loading:brightness-95",
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

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "link";
export type ButtonTone = "default" | "brand" | "destructive";
type ButtonSize = keyof typeof styles.sizes;
type LegacyButtonSize = ButtonSize | "default";
type ButtonColor = keyof typeof styles.colors;
type ButtonIconProps = { className?: string; "data-icon"?: string };

const legacyButtonColorMap: Record<ButtonColor, { variant: ButtonVariant; tone: ButtonTone }> = {
  primary: { variant: "primary", tone: "default" },
  secondary: { variant: "secondary", tone: "default" },
  tertiary: { variant: "tertiary", tone: "default" },
  "link-gray": { variant: "link", tone: "default" },
  "link-color": { variant: "link", tone: "brand" },
  "primary-destructive": { variant: "primary", tone: "destructive" },
  "secondary-destructive": { variant: "secondary", tone: "destructive" },
  "tertiary-destructive": { variant: "tertiary", tone: "destructive" },
  "link-destructive": { variant: "link", tone: "destructive" },
};

const buttonVariantToneMap: Record<ButtonVariant, Record<ButtonTone, ButtonColor>> = {
  primary: {
    default: "primary",
    brand: "primary",
    destructive: "primary-destructive",
  },
  secondary: {
    default: "secondary",
    brand: "secondary",
    destructive: "secondary-destructive",
  },
  tertiary: {
    default: "tertiary",
    brand: "tertiary",
    destructive: "tertiary-destructive",
  },
  link: {
    default: "link-gray",
    brand: "link-color",
    destructive: "link-destructive",
  },
};

function resolveButtonColor({
  variant,
  tone,
  legacyColor,
}: {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  legacyColor?: ButtonColor;
}): ButtonColor {
  const legacyStyle = !variant && !tone && legacyColor ? legacyButtonColorMap[legacyColor] : undefined;
  const resolvedVariant = variant ?? legacyStyle?.variant ?? "primary";
  const resolvedTone = tone ?? legacyStyle?.tone ?? "default";
  return buttonVariantToneMap[resolvedVariant][resolvedTone];
}

/**
 * Common props shared between button and anchor variants
 */
export interface CommonProps {
  /** Canonical visual emphasis for the button. */
  variant?: ButtonVariant;
  /** Canonical semantic tone for the button. */
  tone?: ButtonTone;
  /** The size variant of the button. */
  size?: LegacyButtonSize;
  /** Disables the button and shows a disabled state. */
  disabled?: boolean;
  /** Shows a loading spinner and disables the button. */
  loading?: boolean;
  /** @deprecated Use `variant` and `tone` instead. */
  color?: ButtonColor;
  /** @deprecated Use `disabled` instead. */
  isDisabled?: boolean;
  /** @deprecated Use `loading` instead. */
  isLoading?: boolean;
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
export interface ButtonProps extends CommonProps, DetailedHTMLProps<Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "disabled" | "slot">, HTMLButtonElement> {
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
  variant,
  tone,
  size = "sm",
  color,
  children,
  className,
  noTextPadding,
  iconLeading: IconLeading,
  iconTrailing: IconTrailing,
  disabled,
  isDisabled,
  loading,
  isLoading,
  showTextWhileLoading,
  ...otherProps
}: Props) => {
  const resolvedColor = resolveButtonColor({ variant, tone, legacyColor: color });
  const resolvedSize = size === "default" ? "sm" : size;
  const loadingState = Boolean(loading ?? isLoading);
  const href = "href" in otherProps ? otherProps.href : undefined;
  const Component = href ? AriaLink : AriaButton;

  const isIcon = (IconLeading || IconTrailing) && !children;
  const isLinkType = ["link-gray", "link-color", "link-destructive"].includes(resolvedColor);
  const disabledState = Boolean(disabled ?? isDisabled);

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
      isPending: loadingState,
    };
  }

  return (
    <Component
      data-loading={loadingState ? true : undefined}
      data-icon-only={isIcon ? true : undefined}
      {...props}
      isDisabled={disabledState}
      className={cx(
        styles.common.root,
        styles.sizes[resolvedSize].root,
        styles.colors[resolvedColor].root,
        isLinkType && styles.sizes[resolvedSize].linkRoot,
        (loadingState || (href && (disabledState || loadingState))) && "pointer-events-none",
        loadingState &&
          (showTextWhileLoading ? "[&>*:not([data-icon=loading]):not([data-text])]:hidden" : "[&>*:not([data-icon=loading])]:invisible"),
        className,
      )}
    >
      {/* Leading icon */}
      {renderIconSlot(IconLeading, { "data-icon": "leading", className: styles.common.icon })}

      {loadingState && (
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
