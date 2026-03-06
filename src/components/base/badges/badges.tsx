import type { HTMLAttributes, ReactNode } from "react";
import { Dot } from "@/components/foundations/dot-icon";
import { cx } from "@/lib/utils/cx";
import type {
  BadgeColors,
  BadgeTone,
  BadgeTypeToColorMap,
  BadgeTypes,
  BadgeVariant,
  FlagTypes,
  IconComponentType,
  Sizes,
} from "./badge-types";
import { badgeToneToColor, badgeTypes, badgeVariantToType } from "./badge-types";

const filledColors: Record<BadgeColors, { root: string; addon: string; addonButton: string }> = {
  gray: {
    root: "bg-muted text-foreground ring-border",
    addon: "text-muted-foreground",
    addonButton: "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
  },
  brand: {
    root: "bg-primary/10 text-primary ring-primary/30",
    addon: "text-primary/80",
    addonButton: "text-primary/70 hover:bg-primary/15 hover:text-primary",
  },
  error: {
    root: "bg-destructive/10 text-destructive ring-destructive/30",
    addon: "text-destructive/80",
    addonButton: "text-destructive/70 hover:bg-destructive/15 hover:text-destructive",
  },
  warning: {
    root: "bg-accent/25 text-accent-foreground ring-accent/35",
    addon: "text-accent-foreground/80",
    addonButton: "text-accent-foreground/70 hover:bg-accent/35 hover:text-accent-foreground",
  },
  success: {
    root: "bg-primary/10 text-primary ring-primary/30",
    addon: "text-primary/80",
    addonButton: "text-primary/70 hover:bg-primary/15 hover:text-primary",
  },
  "gray-blue": {
    root: "bg-secondary text-secondary-foreground ring-border",
    addon: "text-muted-foreground",
    addonButton: "text-muted-foreground hover:bg-secondary/85 hover:text-foreground",
  },
  "blue-light": {
    root: "bg-primary/10 text-primary ring-primary/30",
    addon: "text-primary/80",
    addonButton: "text-primary/70 hover:bg-primary/15 hover:text-primary",
  },
  blue: {
    root: "bg-primary/10 text-primary ring-primary/30",
    addon: "text-primary/80",
    addonButton: "text-primary/70 hover:bg-primary/15 hover:text-primary",
  },
  indigo: {
    root: "bg-secondary text-secondary-foreground ring-border",
    addon: "text-muted-foreground",
    addonButton: "text-muted-foreground hover:bg-secondary/85 hover:text-foreground",
  },
  purple: {
    root: "bg-secondary text-secondary-foreground ring-border",
    addon: "text-muted-foreground",
    addonButton: "text-muted-foreground hover:bg-secondary/85 hover:text-foreground",
  },
  pink: {
    root: "bg-destructive/10 text-destructive ring-destructive/30",
    addon: "text-destructive/80",
    addonButton: "text-destructive/70 hover:bg-destructive/15 hover:text-destructive",
  },
  orange: {
    root: "bg-accent/25 text-accent-foreground ring-accent/35",
    addon: "text-accent-foreground/80",
    addonButton: "text-accent-foreground/70 hover:bg-accent/35 hover:text-accent-foreground",
  },
};

const addonOnlyColors = Object.fromEntries(
  Object.entries(filledColors).map(([key, value]) => [key, { root: "", addon: value.addon }]),
) as Record<BadgeColors, { root: string; addon: string }>;

const withPillTypes = {
  [badgeTypes.pillColor]: {
    common: "size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset",
    styles: filledColors,
  },
  [badgeTypes.badgeColor]: {
    common: "size-max flex items-center whitespace-nowrap rounded-md ring-1 ring-inset",
    styles: filledColors,
  },
  [badgeTypes.badgeModern]: {
    common: "size-max flex items-center whitespace-nowrap rounded-md ring-1 ring-inset shadow-xs",
    styles: {
      gray: {
        root: "bg-primary text-secondary ring-primary",
        addon: "text-muted-foreground",
        addonButton: "text-muted-foreground hover:bg-secondary/85 hover:text-foreground",
      },
    },
  },
};

const withBadgeTypes = {
  [badgeTypes.pillColor]: {
    common: "size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset",
    styles: filledColors,
  },
  [badgeTypes.badgeColor]: {
    common: "size-max flex items-center whitespace-nowrap rounded-md ring-1 ring-inset",
    styles: filledColors,
  },
  [badgeTypes.badgeModern]: {
    common: "size-max flex items-center whitespace-nowrap rounded-md ring-1 ring-inset bg-primary text-secondary ring-primary shadow-xs",
    styles: addonOnlyColors,
  },
};

const pillSizes = {
  sm: "py-0.5 px-2 text-xs font-medium",
  md: "py-0.5 px-2.5 text-sm font-medium",
  lg: "py-1 px-3 text-sm font-medium",
};

const badgeSizes = {
  sm: "py-0.5 px-1.5 text-xs font-medium",
  md: "py-0.5 px-2 text-sm font-medium",
  lg: "py-1 px-2.5 text-sm font-medium rounded-lg",
};

const sizes = {
  [badgeTypes.pillColor]: pillSizes,
  [badgeTypes.badgeColor]: badgeSizes,
  [badgeTypes.badgeModern]: badgeSizes,
};

const dotPillSizes = {
  sm: "gap-1 py-0.5 pl-1.5 pr-2 text-xs font-medium",
  md: "gap-1.5 py-0.5 pl-2 pr-2.5 text-sm font-medium",
  lg: "gap-1.5 py-1 pl-2.5 pr-3 text-sm font-medium",
};

const dotBadgeSizes = {
  sm: "gap-1 py-0.5 px-1.5 text-xs font-medium",
  md: "gap-1.5 py-0.5 px-2 text-sm font-medium",
  lg: "gap-1.5 py-1 px-2.5 text-sm font-medium rounded-lg",
};

const dotSizes = {
  [badgeTypes.pillColor]: dotPillSizes,
  [badgeTypes.badgeColor]: dotBadgeSizes,
  [badgeTypes.badgeModern]: dotBadgeSizes,
};

const iconPillSizes = {
  sm: {
    trailing: "gap-0.5 py-0.5 pl-2 pr-1.5 text-xs font-medium",
    leading: "gap-0.5 py-0.5 pr-2 pl-1.5 text-xs font-medium",
  },
  md: {
    trailing: "gap-1 py-0.5 pl-2.5 pr-2 text-sm font-medium",
    leading: "gap-1 py-0.5 pr-2.5 pl-2 text-sm font-medium",
  },
  lg: {
    trailing: "gap-1 py-1 pl-3 pr-2.5 text-sm font-medium",
    leading: "gap-1 py-1 pr-3 pl-2.5 text-sm font-medium",
  },
};

const iconBadgeSizes = {
  sm: {
    trailing: "gap-0.5 py-0.5 pl-2 pr-1.5 text-xs font-medium",
    leading: "gap-0.5 py-0.5 pr-2 pl-1.5 text-xs font-medium",
  },
  md: {
    trailing: "gap-1 py-0.5 pl-2 pr-1.5 text-sm font-medium",
    leading: "gap-1 py-0.5 pr-2 pl-1.5 text-sm font-medium",
  },
  lg: {
    trailing: "gap-1 py-1 pl-2.5 pr-2 text-sm font-medium rounded-lg",
    leading: "gap-1 py-1 pr-2.5 pl-2 text-sm font-medium rounded-lg",
  },
};

const iconSizes = {
  [badgeTypes.pillColor]: iconPillSizes,
  [badgeTypes.badgeColor]: iconBadgeSizes,
  [badgeTypes.badgeModern]: iconBadgeSizes,
};

const flagPillSizes = {
  sm: "gap-1 py-0.5 pl-0.75 pr-2 text-xs font-medium",
  md: "gap-1.5 py-0.5 pl-1 pr-2.5 text-sm font-medium",
  lg: "gap-1.5 py-1 pl-1.5 pr-3 text-sm font-medium",
};

const flagBadgeSizes = {
  sm: "gap-1 py-0.5 pl-1 pr-1.5 text-xs font-medium",
  md: "gap-1.5 py-0.5 pl-1.5 pr-2 text-sm font-medium",
  lg: "gap-1.5 py-1 pl-2 pr-2.5 text-sm font-medium rounded-lg",
};

const flagSizes = {
  [badgeTypes.pillColor]: flagPillSizes,
  [badgeTypes.badgeColor]: flagBadgeSizes,
  [badgeTypes.badgeModern]: flagBadgeSizes,
};

function resolveLegacyType(variant?: BadgeVariant, legacyType?: BadgeTypes): BadgeTypes {
  if (variant) {
    return badgeVariantToType[variant];
  }
  return legacyType ?? badgeTypes.pillColor;
}

function resolveLegacyColor(tone?: BadgeTone, legacyColor?: BadgeColors): BadgeColors {
  if (tone) {
    return badgeToneToColor[tone];
  }
  return legacyColor ?? "gray";
}

function pickSupportedColor<T extends Record<string, unknown>>(styles: T, color: BadgeColors): keyof T {
  if (Object.prototype.hasOwnProperty.call(styles, color)) {
    return color as keyof T;
  }
  return "gray" as keyof T;
}

type BadgeVariantProps = {
  /** Canonical structural style prop. */
  variant?: BadgeVariant;
  /** Canonical semantic tone prop. */
  tone?: BadgeTone;
};

type BadgeLegacyProps = {
  /** @deprecated Use `variant` instead. */
  type?: BadgeTypes;
  /** @deprecated Use `tone` instead. */
  color?: BadgeColors;
};

export type BadgeColor<T extends BadgeTypes> = BadgeTypeToColorMap<typeof withPillTypes>[T];

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, BadgeVariantProps, BadgeLegacyProps {
  size?: Sizes;
  children: ReactNode;
}

export const Badge = ({
  variant,
  tone,
  type,
  size = "md",
  color,
  children,
  className,
  ...rest
}: BadgeProps) => {
  const resolvedType = resolveLegacyType(variant, type);
  const resolvedColor = resolveLegacyColor(tone, color);
  const colors = withPillTypes[resolvedType];
  const safeColor = pickSupportedColor(colors.styles, resolvedColor);

  return (
    <span className={cx(colors.common, sizes[resolvedType][size], colors.styles[safeColor].root, className)} {...rest}>
      {children}
    </span>
  );
};

interface BadgeWithDotProps extends BadgeVariantProps, BadgeLegacyProps {
  size?: Sizes;
  className?: string;
  children: ReactNode;
}

export const BadgeWithDot = ({
  variant,
  tone,
  type,
  size = "md",
  color,
  className,
  children,
}: BadgeWithDotProps) => {
  const resolvedType = resolveLegacyType(variant, type);
  const resolvedColor = resolveLegacyColor(tone, color);
  const colors = withBadgeTypes[resolvedType];
  const safeColor = pickSupportedColor(colors.styles, resolvedColor);

  return (
    <span className={cx(colors.common, dotSizes[resolvedType][size], colors.styles[safeColor].root, className)}>
      <Dot className={colors.styles[safeColor].addon} size="sm" />
      {children}
    </span>
  );
};

interface BadgeWithIconProps extends BadgeVariantProps, BadgeLegacyProps {
  size?: Sizes;
  iconLeading?: IconComponentType;
  iconTrailing?: IconComponentType;
  children: ReactNode;
  className?: string;
}

export const BadgeWithIcon = ({
  variant,
  tone,
  type,
  size = "md",
  color,
  iconLeading: IconLeading,
  iconTrailing: IconTrailing,
  children,
  className,
}: BadgeWithIconProps) => {
  const resolvedType = resolveLegacyType(variant, type);
  const resolvedColor = resolveLegacyColor(tone, color);
  const colors = withBadgeTypes[resolvedType];
  const safeColor = pickSupportedColor(colors.styles, resolvedColor);
  const icon = IconLeading ? "leading" : "trailing";

  return (
    <span className={cx(colors.common, iconSizes[resolvedType][size][icon], colors.styles[safeColor].root, className)}>
      {IconLeading && <IconLeading className={cx(colors.styles[safeColor].addon, "size-3 stroke-3")} />}
      {children}
      {IconTrailing && <IconTrailing className={cx(colors.styles[safeColor].addon, "size-3 stroke-3")} />}
    </span>
  );
};

interface BadgeWithFlagProps extends BadgeVariantProps, BadgeLegacyProps {
  size?: Sizes;
  flag?: FlagTypes;
  children: ReactNode;
}

export const BadgeWithFlag = ({
  variant,
  tone,
  type,
  size = "md",
  color,
  flag = "AU",
  children,
}: BadgeWithFlagProps) => {
  const resolvedType = resolveLegacyType(variant, type);
  const resolvedColor = resolveLegacyColor(tone, color);
  const colors = withPillTypes[resolvedType];
  const safeColor = pickSupportedColor(colors.styles, resolvedColor);

  return (
    <span className={cx(colors.common, flagSizes[resolvedType][size], colors.styles[safeColor].root)}>
      <img src={`https://www.untitledui.com/images/flags/${flag}.svg`} className="size-4 max-w-none rounded-full" alt={`${flag} flag`} />
      {children}
    </span>
  );
};

interface BadgeWithImageProps extends BadgeVariantProps, BadgeLegacyProps {
  size?: Sizes;
  imgSrc: string;
  children: ReactNode;
}

export const BadgeWithImage = ({
  variant,
  tone,
  type,
  size = "md",
  color,
  imgSrc,
  children,
}: BadgeWithImageProps) => {
  const resolvedType = resolveLegacyType(variant, type);
  const resolvedColor = resolveLegacyColor(tone, color);
  const colors = withPillTypes[resolvedType];
  const safeColor = pickSupportedColor(colors.styles, resolvedColor);

  return (
    <span className={cx(colors.common, flagSizes[resolvedType][size], colors.styles[safeColor].root)}>
      <img src={imgSrc} className="size-4 max-w-none rounded-full" alt="Badge image" />
      {children}
    </span>
  );
};
