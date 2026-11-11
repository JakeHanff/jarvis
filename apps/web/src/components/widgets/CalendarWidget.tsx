"use client";

import { CalendarDays, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api, invalidate, todayISO } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { CalEvent } from "@/lib/types";
import { Empty, ErrorNote, WidgetFrame } from "./WidgetFrame";
import type { WidgetProps } from "./types";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function dayHeading(d: Date) {
  const key = todayISO(d);
  if (key === todayISO()) return "Today";
  if (key === todayISO(new Date(Date.now() + 86400000))) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export function useUpcomingEvents(days = 7) {
  const range = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + days * 86400000);
    return `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  }, [days]);
  return useApi<CalEvent[]>(`/api/events?${range}`);
}

export function CalendarWidget(props: WidgetProps) {
  const { data, error } = useUpcomingEvents(7);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", date: todayISO(), start: "16:00", end: "17:00", location: "" });
  const [formError, setFormError] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, { date: Date; items: CalEvent[] }>();
    for (const e of data ?? []) {
      const d = new Date(e.start);
      const key = todayISO(d);
      if (!map.has(key)) map.set(key, { date: d, items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.values()];
  }, [data]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const start = new Date(`${form.date}T${form.start}`);
    const end = new Date(`${form.date}T${form.end}`);
    if (!(end > start)) return setFormError("End must be after start.");
    try {
      await api("/api/events", {
        method: "POST",
        json: { title: form.title.trim(), start: start.toISOString(), end: end.toISOString(), location: form.location },
      });
      setForm((f) => ({ ...f, title: "", location: "" }));
      setAdding(false);
      setFormError("");
      invalidate("/api/events", "/api/insights");
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  return (
    <WidgetFrame
      {...props.frame}
      title="Calendar"
      icon={<CalendarDays size={15} />}
      actions={
        <button className="icon-btn" onClick={() => setAdding((a) => !a)} aria-label={adding ? "Cancel" : "Add event"}>
          {adding ? <X size={15} /> : <Plus size={15} />}
        </button>
      }
    >
      {adding && (
        <form onSubmit={add} className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-line p-2.5">
          <input className="field col-span-2" placeholder="Event title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input type="date" className="field col-span-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Date" />
          <input type="time" className="field" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-label="Start" />
          <input type="time" className="field" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-label="End" />
          <input className="field col-span-2" placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          {formError && <p className="col-span-2 text-[12px] text-danger">{formError}</p>}
          <button className="btn btn-primary col-span-2 justify-center" disabled={!form.title.trim()}>
            Add event
          </button>
        </form>
      )}
      {error && <ErrorNote message={error.message} />}
      <div className="scroll-thin max-h-[360px] space-y-3 overflow-y-auto">
        {groups.map((g) => (
          <div key={todayISO(g.date)}>
            <div className="label mb-1">{dayHeading(g.date)}</div>
            <ul className="space-y-1">
              {g.items.map((e) => (
                <li key={e.id} className="group flex items-start gap-2.5 rounded-lg px-1.5 py-1 hover:bg-hover">
                  <span className="mt-1 h-8 w-[3px] shrink-0 rounded-full bg-accent/70" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">{e.title}</div>
                    <div className="text-[12px] text-muted">
                      {e.all_day ? "All day" : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}
                      {e.location && ` · ${e.location}`}
                    </div>
                  </div>
                  <button
                    className="icon-btn !h-6 !w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={async () => {
                      await api(`/api/events/${e.id}`, { method: "DELETE" });
                      invalidate("/api/events", "/api/insights");
                    }}
                    aria-label="Delete event"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {data && groups.length === 0 && <Empty>No events in the next 7 days.</Empty>}
      </div>
      <p className="mt-3 border-t border-line pt-2 text-[11px] text-faint">Local JARVIS calendar · Google Calendar not connected yet</p>
    </WidgetFrame>
  );
}
