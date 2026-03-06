import { cva } from "class-variance-authority";

/**
 * Legacy button variant map retained for Radix primitives that still consume cva-style variants.
 * New app code should prefer Button `variant` + `tone`.
 */
export const buttonVariants = cva(
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
          "border border-destructive/30 text-destructive-foreground bg-[linear-gradient(135deg,hsl(var(--destructive)),hsl(var(--destructive-strong)))] shadow-[0_12px_24px_-18px_hsl(var(--destructive)/0.8)] hover:brightness-105",
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
