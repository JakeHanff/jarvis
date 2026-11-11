"use client";

import { ArrowRight, Clock, Flame, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { todayISO } from "@/lib/api";
import { useApi, useNow } from "@/lib/hooks";
import type { Task } from "@/lib/types";
import { useUpcomingEvents } from "./CalendarWidget";
import type { WidgetProps } from "./types";
import { WidgetFrame } from "./WidgetFrame";

function greeting(h: number) {
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line px-3.5 py-3">
      <div className="label">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export function OverviewWidget(props: WidgetProps) {
  const now = useNow(15000);
  const { data: tasks } = useApi<Task[]>("/api/tasks?status=open");
  const { data: events } = useUpcomingEvents(2);

  const s = useMemo(() => {
    const today = todayISO();
    const open = tasks ?? [];
    const daily = open.filter((t) => t.kind === "daily");
    const dueToday = daily.filter((t) => t.due_date === today);
    const overdue = open.filter((t) => t.due_date && t.due_date < today);
    const focus = [...daily]
      .sort((a, b) => a.priority - b.priority || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
      .slice(0, 3);
    const nowMs = Date.now();
    const todayEvents = (events ?? []).filter((e) => todayISO(new Date(e.start)) === today);
    const next = (events ?? []).find((e) => new Date(e.end).getTime() > nowMs);
    const goals = open.filter((t) => t.kind === "goal");
    const avgGoal = goals.length ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : null;
    return { dueToday, overdue, focus, todayEvents, next, goals, avgGoal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, events, now]);

  const nextLabel = s.next
    ? `${new Date(s.next.start) <= new Date() ? "Now" : new Date(s.next.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · ${s.next.title}`
    : "Nothing else coming up";

  return (
    <WidgetFrame {...props.frame} title="Daily overview" icon={<Sparkles size={15} />}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-muted">
            {now ? now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}
          </div>
          <h1 className="mt-1 font-display text-[clamp(28px,3.4vw,46px)] font-semibold leading-[1.05] tracking-tight">
            {now ? greeting(now.getHours()) : " "}
            <span className="text-accent">.</span>
          </h1>
          <div className="mt-2 flex items-center gap-2 font-mono text-[clamp(18px,1.6vw,22px)] tabular-nums text-fg/80">
            <Clock size={16} className="text-faint" />
            {now ? now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </div>
        </div>
        <div className="grid flex-[1.4] grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Due today" value={s.dueToday.length} hint={s.overdue.length ? `${s.overdue.length} overdue` : "On track"} />
          <Stat label="Events today" value={s.todayEvents.length} hint={nextLabel} />
          <Stat label="Open tasks" value={(tasks ?? []).filter((t) => t.kind === "daily").length} />
          <Stat label="Goals" value={s.goals.length} hint={s.avgGoal !== null ? `avg ${s.avgGoal}% done` : "None set"} />
        </div>
      </div>
      {s.focus.length > 0 && (
        <div className="mt-5 border-t border-line pt-3.5">
          <div className="label mb-2 flex items-center gap-1.5">
            <Flame size={12} /> Focus
          </div>
          <div className="flex flex-wrap gap-2">
            {s.focus.map((t) => (
              <span key={t.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px]">
                <ArrowRight size={12} className="text-accent" />
                <span className="truncate">{t.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </WidgetFrame>
  );
}
