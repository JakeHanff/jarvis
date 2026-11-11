import type { ComponentType } from "react";
import type { WidgetSize, WidgetType } from "@/lib/settings";
import { AssistantWidget } from "./AssistantWidget";
import { CalendarWidget } from "./CalendarWidget";
import { GoalsWidget } from "./GoalsWidget";
import { InsightsWidget } from "./InsightsWidget";
import { MemoryWidget } from "./MemoryWidget";
import { OverviewWidget } from "./OverviewWidget";
import { TasksWidget } from "./TasksWidget";
import type { WidgetProps } from "./types";

/** Add a widget = add an entry here. Layout, visibility and sizing come for free. */
export const WIDGETS: Record<WidgetType, { label: string; component: ComponentType<WidgetProps> }> = {
  overview: { label: "Daily overview", component: OverviewWidget },
  assistant: { label: "JARVIS assistant", component: AssistantWidget },
  tasks: { label: "Today’s tasks", component: TasksWidget },
  goals: { label: "Goals & long-term", component: GoalsWidget },
  calendar: { label: "Calendar", component: CalendarWidget },
  memory: { label: "Memory", component: MemoryWidget },
  insights: { label: "Insights", component: InsightsWidget },
};

export const SIZES: WidgetSize[] = ["sm", "md", "lg", "xl", "full"];
export const SIZE_LABEL: Record<WidgetSize, string> = { sm: "1/4", md: "1/3", lg: "1/2", xl: "2/3", full: "Full" };
// 12-column grid on large screens, 6 on medium, 1 on phones.
export const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: "md:col-span-3 xl:col-span-3",
  md: "md:col-span-3 xl:col-span-4",
  lg: "md:col-span-6 xl:col-span-6",
  xl: "md:col-span-6 xl:col-span-8",
  full: "md:col-span-6 xl:col-span-12",
};
