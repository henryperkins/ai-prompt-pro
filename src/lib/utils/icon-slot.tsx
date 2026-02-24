import type { ComponentType, ReactNode } from "react";
import { isValidElement } from "react";
import { isReactComponent } from "@/lib/utils/is-react-component";

export type IconComponent<TProps extends object = { className?: string }> = ComponentType<TProps>;
export type IconSlot<TProps extends object = { className?: string }> = IconComponent<TProps> | ReactNode;

export function renderIconSlot<TProps extends object>(icon: IconSlot<TProps> | null | undefined, props: TProps): ReactNode {
  if (isReactComponent(icon)) {
    const Icon = icon as IconComponent<TProps>;
    return <Icon {...props} />;
  }

  if (isValidElement(icon)) {
    return icon;
  }

  return null;
}
