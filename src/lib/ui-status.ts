export const UI_STATUS_SURFACE_CLASSES = {
  info: "border-primary/30 bg-primary/10 text-primary",
  success: "border-utility-success-200 bg-utility-success-50 text-utility-success-700",
  warning: "border-utility-warning-200 bg-utility-warning-50 text-utility-warning-700",
  danger: "border-utility-error-200 bg-utility-error-50 text-utility-error-700",
} as const;

export const UI_STATUS_TEXT_CLASSES = {
  info: "text-primary",
  success: "text-utility-success-700",
  warning: "text-utility-warning-700",
  danger: "text-utility-error-700",
} as const;

export const UI_STATUS_ROW_CLASSES = {
  success: "bg-utility-success-50 text-utility-success-700",
  warning: "bg-utility-warning-50 text-utility-warning-700",
  danger: "bg-utility-error-50 text-utility-error-700",
} as const;