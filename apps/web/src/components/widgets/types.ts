import type { ComponentProps } from "react";
import type { WidgetFrame } from "./WidgetFrame";

type FrameProps = Omit<ComponentProps<typeof WidgetFrame>, "title" | "children" | "icon" | "actions">;

export interface WidgetProps {
  /** Edit-mode props forwarded into the WidgetFrame (drag, hide, resize). */
  frame: FrameProps;
}
