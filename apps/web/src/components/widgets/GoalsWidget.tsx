"use client";

import { Check, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, invalidate } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Task } from "@/lib/types";
import { dueLabel } from "./TasksWidget";
import { Empty, ErrorNote, WidgetFrame } from "./WidgetFrame";
import type { WidgetProps } from "./types";

function GoalRow({ t }: { t: Task }) {
  const [progress, setProgress] = useState(t.progress);
  const due = dueLabel(t.due_date);
  const done = t.status === "done";
  async function patch(body: Record<string, unknown>) {
    await api(`/api/tasks/${t.id}`, { method: "PATCH", json: body });
    invalidate("/api/tasks", "/api/insights");
  }
  return (
    <li className="group rounded-xl border border-line px-3 py-2.5 hover:border-line-strong">
      <div className="flex items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-[14px] font-medium ${done ? "text-faint line-through" : ""}`}>{t.title}</span>
        {due && !done && <span className={`text-[11px] ${due.tone}`}>{due.text}</span>}
        <button className="icon-btn !h-6 !w-6" onClick={() => patch({ status: done ? "open" : "done" })} aria-label={done ? "Reopen" : "Mark complete"}>
          <Check size={14} />
        </button>
        <button
          className="icon-btn !h-6 !w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
          onClick={async () => {
            await api(`/api/tasks/${t.id}`, { method: "DELETE" });
            invalidate("/api/tasks", "/api/insights");
          }}
          aria-label="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {t.kind === "goal" && (
        <div className="mt-2 flex items-center gap-2.5">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            onPointerUp={() => progress !== t.progress && patch({ progress })}
            onKeyUp={() => progress !== t.progress && patch({ progress })}
            className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
            aria-label={`Progress for ${t.title}`}
          />
          <span className="w-9 text-right font-mono text-[11px] text-muted">{progress}%</span>
        </div>
      )}
      {t.notes && <p className="mt-1 line-clamp-2 text-[12px] text-muted">{t.notes}</p>}
    </li>
  );
}

export function GoalsWidget(props: WidgetProps) {
  const [tab, setTab] = useState<"goal" | "long_term">("goal");
  const { data, error } = useApi<Task[]>(`/api/tasks?kind=${tab}`);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const items = (data ?? []).filter((t) => t.status !== "archived").sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api("/api/tasks", { method: "POST", json: { title: title.trim(), kind: tab, due_date: due || null } });
    setTitle("");
    setDue("");
    invalidate("/api/tasks", "/api/insights");
  }

  return (
    <WidgetFrame
      {...props.frame}
      title="Goals & long-term"
      icon={<Target size={15} />}
      actions={
        <div className="flex rounded-lg border border-line p-0.5 text-[12px]">
          {(["goal", "long_term"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-2 py-0.5 ${tab === k ? "accent-soft" : "text-muted hover:text-fg"}`}>
              {k === "goal" ? "Goals" : "Long-term"}
            </button>
          ))}
        </div>
      }
    >
      <form onSubmit={add} className="mb-2.5 flex gap-1.5">
        <input className="field flex-1" placeholder={tab === "goal" ? "New goal…" : "New long-term task…"} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="date" className="field w-[138px] text-xs" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Target date" />
        <button className="btn btn-primary !px-2.5" disabled={!title.trim()} aria-label="Add">
          <Plus size={15} />
        </button>
      </form>
      {error && <ErrorNote message={error.message} />}
      <ul className="scroll-thin max-h-[360px] space-y-2 overflow-y-auto">
        {items.map((t) => (
          <GoalRow key={t.id} t={t} />
        ))}
        {data && items.length === 0 && (
          <Empty>{tab === "goal" ? "No goals yet. What are you working towards?" : "No long-term tasks yet."}</Empty>
        )}
      </ul>
    </WidgetFrame>
  );
}
