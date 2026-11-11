"use client";

import { Archive, Check, Clock3, History, Pencil, RotateCcw, ThumbsDown, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api, invalidate } from "@/lib/api";
import type { Memory, MemoryLayer } from "@/lib/types";

export const LAYER_LABEL: Record<MemoryLayer, string> = {
  core_identity: "Core identity",
  life_context: "Life context",
  projects_goals: "Projects & goals",
  short_term: "Short-term",
  behavioural: "Behavioural",
  assistant_operating: "Assistant ops",
};

export const LAYER_HINT: Record<MemoryLayer, string> = {
  core_identity: "Stable personality, values, long-term interests",
  life_context: "Current circumstances — school, work, routines",
  projects_goals: "Active projects, decisions, milestones",
  short_term: "Current assignments, research, recent context",
  behavioural: "Observed patterns and tendencies",
  assistant_operating: "How JARVIS itself should operate",
};

const VERIFY: Record<Memory["verification"], { label: string; cls: string }> = {
  user_confirmed: { label: "Confirmed", cls: "text-ok" },
  user_corrected: { label: "Corrected", cls: "text-accent" },
  unverified: { label: "Unverified", cls: "text-warn" },
};

function refresh() {
  invalidate("/api/memories", "/api/insights");
}

export function MemoryCard({ m, compact = false }: { m: Memory; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(m.content);
  const [layer, setLayer] = useState<MemoryLayer>(m.layer);
  const [showHistory, setShowHistory] = useState(false);
  const [err, setErr] = useState("");

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      setErr("");
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const proposed = m.status === "proposed";
  const inactive = ["superseded", "rejected", "archived"].includes(m.status);
  const v = VERIFY[m.verification];

  return (
    <li className={`group rounded-xl border px-3 py-2.5 ${proposed ? "border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.05)]" : "border-line"} ${inactive ? "opacity-60" : ""}`}>
      {editing ? (
        <div className="space-y-2">
          <textarea className="field min-h-[70px] w-full" value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <select className="field text-xs" value={layer} onChange={(e) => setLayer(e.target.value as MemoryLayer)}>
              {Object.entries(LAYER_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() =>
                run(async () => {
                  await api(`/api/memories/${m.id}`, { method: "PATCH", json: { content, layer, note: "edited in memory panel" } });
                  setEditing(false);
                })
              }
            >
              Save correction
            </button>
            <button
              className="btn"
              title="Keep the old version in history and store this as the current one"
              onClick={() =>
                run(async () => {
                  await api(`/api/memories/${m.id}/supersede`, { method: "POST", json: { content, note: "updated by user" } });
                  setEditing(false);
                })
              }
            >
              Save as update
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className={`whitespace-pre-wrap text-[14px] leading-snug ${compact ? "line-clamp-3" : ""}`}>{m.content}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="chip">{LAYER_LABEL[m.layer]}</span>
        <span className="chip" title="stated = you said it; inferred = JARVIS concluded it; observed = pattern from data">
          {m.kind}
        </span>
        {m.kind !== "stated" || m.confidence < 1 ? <span className="chip">{Math.round(m.confidence * 100)}%</span> : null}
        <span className={`chip ${v.cls}`}>{v.label}</span>
        {m.is_temporary && (
          <span className="chip">
            <Clock3 size={10} /> temporary
          </span>
        )}
        {m.status !== "active" && <span className="chip text-muted">{m.status}</span>}
        {!compact && <span className="text-[11px] text-faint">from {m.source}</span>}

        <div className="ml-auto flex items-center gap-0.5">
          {proposed ? (
            <>
              <button className="btn !py-1 text-xs" onClick={() => run(() => api(`/api/memories/${m.id}/confirm`, { method: "POST" }))}>
                <Check size={13} /> Keep
              </button>
              <button className="btn btn-ghost !py-1 text-xs" onClick={() => run(() => api(`/api/memories/${m.id}/reject`, { method: "POST" }))}>
                <X size={13} /> Discard
              </button>
            </>
          ) : (
            !inactive && (
              <div className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                {m.verification !== "user_confirmed" && (
                  <button className="icon-btn !h-7 !w-7" title="Confirm this is right" onClick={() => run(() => api(`/api/memories/${m.id}/confirm`, { method: "POST" }))}>
                    <Check size={14} />
                  </button>
                )}
                <button
                  className="icon-btn !h-7 !w-7"
                  title="This is wrong (lowers confidence, flags for review)"
                  onClick={() => run(() => api("/api/feedback", { method: "POST", json: { target_type: "memory", target_id: m.id, kind: "incorrect" } }))}
                >
                  <ThumbsDown size={14} />
                </button>
                <button className="icon-btn !h-7 !w-7" title="Edit / correct" onClick={() => setEditing(true)}>
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-btn !h-7 !w-7"
                  title={m.is_temporary ? "Mark as lasting" : "Mark as temporary"}
                  onClick={() => run(() => api(`/api/memories/${m.id}`, { method: "PATCH", json: { is_temporary: !m.is_temporary } }))}
                >
                  <Clock3 size={14} />
                </button>
                <button className="icon-btn !h-7 !w-7" title="Archive (stop using, keep record)" onClick={() => run(() => api(`/api/memories/${m.id}`, { method: "PATCH", json: { status: "archived" } }))}>
                  <Archive size={14} />
                </button>
                <button
                  className="icon-btn !h-7 !w-7 hover:!text-danger"
                  title="Delete permanently"
                  onClick={() => confirm("Delete this memory permanently?") && run(() => api(`/api/memories/${m.id}`, { method: "DELETE" }))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          )}
          {m.status === "archived" && (
            <button className="icon-btn !h-7 !w-7" title="Restore" onClick={() => run(() => api(`/api/memories/${m.id}/confirm`, { method: "POST" }))}>
              <RotateCcw size={14} />
            </button>
          )}
          {!compact && m.correction_history.length > 0 && (
            <button className="icon-btn !h-7 !w-7" title="Change history" onClick={() => setShowHistory((s) => !s)}>
              <History size={14} />
            </button>
          )}
        </div>
      </div>
      {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
      {showHistory && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2 text-[12px] text-muted">
          {m.correction_history.map((h, i) => (
            <li key={i}>
              <span className="text-faint">{new Date(h.at).toLocaleString()}</span> · {h.field}: <s>{String(h.old)}</s> → {String(h.new)}
              {h.note && <em className="text-faint"> ({h.note})</em>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
