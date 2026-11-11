"use client";

import { Brain, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, invalidate } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Memory, MemoryLayer } from "@/lib/types";
import { LAYER_HINT, LAYER_LABEL, MemoryCard } from "../memory/MemoryCard";
import { Empty, ErrorNote, WidgetFrame } from "./WidgetFrame";
import type { WidgetProps } from "./types";

export function QuickAddMemory({ onDone }: { onDone?: () => void }) {
  const [content, setContent] = useState("");
  const [layer, setLayer] = useState<MemoryLayer>("core_identity");
  const [temp, setTemp] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form
      className="flex flex-col gap-1.5 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!content.trim()) return;
        try {
          await api("/api/memories", { method: "POST", json: { content: content.trim(), layer, is_temporary: temp || layer === "short_term" } });
          setContent("");
          setErr("");
          invalidate("/api/memories", "/api/insights");
          onDone?.();
        } catch (e2) {
          setErr((e2 as Error).message);
        }
      }}
    >
      <input className="field flex-1" placeholder="Tell JARVIS something to remember…" value={content} onChange={(e) => setContent(e.target.value)} />
      <div className="flex gap-1.5">
        <select className="field text-xs" value={layer} onChange={(e) => setLayer(e.target.value as MemoryLayer)} title={LAYER_HINT[layer]}>
          {Object.entries(LAYER_LABEL)
            .filter(([k]) => k !== "assistant_operating")
            .map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
        </select>
        <label className="flex items-center gap-1 text-[12px] text-muted" title="Will be flagged for review instead of treated as permanent">
          <input type="checkbox" checked={temp} onChange={(e) => setTemp(e.target.checked)} className="accent-[var(--accent)]" /> temp
        </label>
        <button className="btn btn-primary !px-2.5" disabled={!content.trim()} aria-label="Remember">
          <Plus size={15} />
        </button>
      </div>
      {err && <p className="text-[12px] text-danger">{err}</p>}
    </form>
  );
}

export function MemoryWidget(props: WidgetProps) {
  const { data, error } = useApi<Memory[]>("/api/memories");
  const stats = useMemo(() => {
    const all = data ?? [];
    const active = all.filter((m) => m.status === "active");
    const proposed = all.filter((m) => m.status === "proposed");
    const byLayer = Object.keys(LAYER_LABEL).map((l) => ({ layer: l as MemoryLayer, n: active.filter((m) => m.layer === l).length }));
    const unverified = active.filter((m) => m.verification === "unverified").length;
    const recent = [...active].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4);
    return { active, proposed, byLayer, unverified, recent };
  }, [data]);

  return (
    <WidgetFrame
      {...props.frame}
      title="Memory"
      icon={<Brain size={15} />}
      actions={
        <Link href="/memory" className="btn btn-ghost !py-1 text-xs">
          Manage <ChevronRight size={13} />
        </Link>
      }
    >
      {error && <ErrorNote message={error.message} />}
      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {stats.byLayer.map((l) => (
          <Link key={l.layer} href={`/memory?layer=${l.layer}`} className="rounded-lg border border-line px-2 py-1.5 hover:border-line-strong" title={LAYER_HINT[l.layer]}>
            <div className="truncate text-[10px] uppercase tracking-wider text-faint">{LAYER_LABEL[l.layer]}</div>
            <div className="font-display text-lg font-semibold tabular-nums">{l.n}</div>
          </Link>
        ))}
      </div>
      <QuickAddMemory />
      <div className="scroll-thin mt-3 max-h-[300px] overflow-y-auto">
        {stats.proposed.length > 0 && (
          <>
            <div className="label mb-1.5">Review — JARVIS only uses these after you keep them</div>
            <ul className="mb-3 space-y-1.5">
              {stats.proposed.slice(0, 5).map((m) => (
                <MemoryCard key={m.id} m={m} compact />
              ))}
            </ul>
            {stats.proposed.length > 5 && (
              <Link href="/memory?status=proposed" className="mb-3 block text-[12px] text-accent">
                + {stats.proposed.length - 5} more to review
              </Link>
            )}
          </>
        )}
        <div className="label mb-1.5">Recently updated</div>
        <ul className="space-y-1.5">
          {stats.recent.map((m) => (
            <MemoryCard key={m.id} m={m} compact />
          ))}
        </ul>
        {data && stats.active.length === 0 && stats.proposed.length === 0 && (
          <Empty>JARVIS doesn’t know anything about you yet. Add a fact above, or import your profile in Settings.</Empty>
        )}
      </div>
    </WidgetFrame>
  );
}
