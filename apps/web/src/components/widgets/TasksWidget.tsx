"use client";

import { Check, ChevronDown, ListTodo, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api, invalidate, todayISO } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Task } from "@/lib/types";
import { Empty, ErrorNote, WidgetFrame } from "./WidgetFrame";
import type { WidgetProps } from "./types";

const PRIORITY_COLOR: Record<number, string> = { 1: "var(--danger)", 2: "var(--accent)", 3: "var(--faint)" };

export function dueLabel(due: string | null): { text: string; tone: string } | null {
  if (!due) return null;
  const today = todayISO();
  const tomorrow = todayISO(new Date(Date.now() + 86400000));
  if (due < today) return { text: "Overdue", tone: "text-danger" };
  if (due === today) return { text: "Today", tone: "text-warn" };
  if (due === tomorrow) return { text: "Tomorrow", tone: "text-muted" };
  const d = new Date(due + "T00:00:00");
  return { text: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), tone: "text-muted" };
}

export function TaskRow({ task, onChanged }: { task: Task; onChanged?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const done = task.status === "done";
  const due = dueLabel(task.due_date);

  async function patch(body: Record<string, unknown>) {
    await api(`/api/tasks/${task.id}`, { method: "PATCH", json: body });
    invalidate("/api/tasks", "/api/insights");
    onChanged?.();
  }

  return (
    <li className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-hover">
      <button
        onClick={() => patch({ status: done ? "open" : "done" })}
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition ${
          done ? "border-transparent bg-accent text-black" : "border-line-strong hover:border-accent"
        }`}
        aria-label={done ? "Mark as not done" : "Mark as done"}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[task.priority] }} title={`Priority ${task.priority}`} />
      {editing ? (
        <input
          autoFocus
          className="field flex-1 !py-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (title.trim() && title !== task.title) patch({ title: title.trim() });
            else setTitle(task.title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTitle(task.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className={`min-w-0 flex-1 truncate text-[14px] ${done ? "text-faint line-through" : ""}`}
          title="Double-click to edit"
        >
          {task.title}
        </span>
      )}
      {due && !done && <span className={`text-[11px] ${due.tone}`}>{due.text}</span>}
      <button
        className="icon-btn !h-6 !w-6 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        onClick={async () => {
          await api(`/api/tasks/${task.id}`, { method: "DELETE" });
          invalidate("/api/tasks", "/api/insights");
        }}
        aria-label="Delete task"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}

export function TasksWidget(props: WidgetProps) {
  const { data, error } = useApi<Task[]>("/api/tasks?kind=daily");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<"" | "today" | "tomorrow">("today");
  const [priority, setPriority] = useState(2);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const { open, doneToday } = useMemo(() => {
    const today = todayISO();
    const all = data ?? [];
    const open = all
      .filter((t) => t.status === "open")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.priority - b.priority || a.sort_order - b.sort_order);
    const doneToday = all.filter((t) => t.status === "done" && t.completed_at && todayISO(new Date(t.completed_at)) === today);
    return { open, doneToday };
  }, [data]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const due_date = due === "today" ? todayISO() : due === "tomorrow" ? todayISO(new Date(Date.now() + 86400000)) : null;
    try {
      await api("/api/tasks", { method: "POST", json: { title: title.trim(), kind: "daily", due_date, priority } });
      setTitle("");
      invalidate("/api/tasks", "/api/insights");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WidgetFrame
      {...props.frame}
      title="Today’s tasks"
      icon={<ListTodo size={15} />}
      actions={<span className="chip">{open.length} open</span>}
      bodyClassName="flex flex-col"
    >
      <form onSubmit={add} className="mb-2 flex gap-1.5">
        <input className="field flex-1" placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New task" />
        <select className="field !px-1.5 text-xs" value={due} onChange={(e) => setDue(e.target.value as typeof due)} aria-label="Due">
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="">No date</option>
        </select>
        <select className="field !px-1.5 text-xs" value={priority} onChange={(e) => setPriority(Number(e.target.value))} aria-label="Priority">
          <option value={1}>High</option>
          <option value={2}>Normal</option>
          <option value={3}>Low</option>
        </select>
        <button className="btn btn-primary !px-2.5" disabled={busy || !title.trim()} aria-label="Add task">
          <Plus size={15} />
        </button>
      </form>
      {error && <ErrorNote message={error.message} />}
      <ul className="scroll-thin -mx-1.5 max-h-[340px] min-h-0 flex-1 overflow-y-auto">
        {open.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
        {data && open.length === 0 && <Empty>Nothing open. Add what matters today.</Empty>}
      </ul>
      {doneToday.length > 0 && (
        <div className="mt-2 border-t border-line pt-2">
          <button className="flex items-center gap-1 text-[12px] text-muted hover:text-fg" onClick={() => setShowDone((s) => !s)}>
            <ChevronDown size={13} className={`transition ${showDone ? "" : "-rotate-90"}`} />
            Completed today ({doneToday.length})
          </button>
          {showDone && (
            <ul className="-mx-1.5 mt-1">
              {doneToday.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </div>
      )}
    </WidgetFrame>
  );
}
