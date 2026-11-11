"use client";

import { Download, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { LAYER_HINT, LAYER_LABEL, MemoryCard } from "@/components/memory/MemoryCard";
import { TopBar } from "@/components/shell/TopBar";
import { QuickAddMemory } from "@/components/widgets/MemoryWidget";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Memory, MemoryLayer } from "@/lib/types";

const STATUSES = ["active", "proposed", "archived", "superseded", "rejected"] as const;

function MemoryManager() {
  const params = useSearchParams();
  const router = useRouter();
  const layer = (params.get("layer") ?? "") as MemoryLayer | "";
  const status = params.get("status") ?? "active";
  const [q, setQ] = useState("");
  const { data, error } = useApi<Memory[]>("/api/memories");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of data ?? []) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (m) => m.status === status && (!layer || m.layer === layer) && (!needle || m.content.toLowerCase().includes(needle) || m.category.toLowerCase().includes(needle)),
    );
  }, [data, status, layer, q]);

  const grouped = useMemo(() => {
    const g = new Map<MemoryLayer, Memory[]>();
    for (const m of filtered) {
      if (!g.has(m.layer)) g.set(m.layer, []);
      g.get(m.layer)!.push(m);
    }
    return (Object.keys(LAYER_LABEL) as MemoryLayer[]).filter((l) => g.has(l)).map((l) => ({ layer: l, items: g.get(l)! }));
  }, [filtered]);

  function setParam(k: string, v: string) {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`/memory?${p.toString()}`);
  }

  async function exportAll() {
    const data = await api("/api/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jarvis-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="grid gap-[var(--gap)] lg:grid-cols-[260px_1fr]">
      <aside className="glass h-fit space-y-4 p-4">
        <div>
          <h1 className="font-display text-xl font-semibold">What JARVIS believes</h1>
          <p className="mt-1 text-[13px] text-muted">Everything here is yours to correct, confirm, archive or delete. Proposed items are not used until you keep them.</p>
        </div>
        <div>
          <div className="label mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setParam("status", s)} className={`chip capitalize ${status === s ? "!border-[rgb(var(--accent-rgb)/0.6)] accent-soft" : "hover:text-fg"}`}>
                {s} {counts[s] ? `· ${counts[s]}` : ""}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-1.5">Layer</div>
          <div className="space-y-0.5">
            <button onClick={() => setParam("layer", "")} className={`block w-full rounded-lg px-2 py-1.5 text-left text-[13px] ${!layer ? "bg-hover text-fg" : "text-muted hover:text-fg"}`}>
              All layers
            </button>
            {(Object.keys(LAYER_LABEL) as MemoryLayer[]).map((l) => (
              <button key={l} onClick={() => setParam("layer", l)} className={`block w-full rounded-lg px-2 py-1.5 text-left ${layer === l ? "bg-hover" : "hover:bg-hover"}`}>
                <div className={`text-[13px] ${layer === l ? "text-fg" : "text-muted"}`}>{LAYER_LABEL[l]}</div>
                <div className="text-[11px] text-faint">{LAYER_HINT[l]}</div>
              </button>
            ))}
          </div>
        </div>
        <button className="btn w-full justify-center" onClick={exportAll}>
          <Download size={14} /> Export all my data
        </button>
      </aside>
      <section className="glass min-w-0 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input className="field w-full !pl-8" placeholder="Search memories…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="mb-4">
          <QuickAddMemory />
        </div>
        {error && <p className="text-[13px] text-danger">{error.message}</p>}
        {grouped.map((g) => (
          <div key={g.layer} className="mb-5">
            <div className="label mb-2">
              {LAYER_LABEL[g.layer]} · {g.items.length}
            </div>
            <ul className="space-y-2">
              {g.items.map((m) => (
                <MemoryCard key={m.id} m={m} />
              ))}
            </ul>
          </div>
        ))}
        {data && filtered.length === 0 && <p className="py-10 text-center text-[13px] text-faint">No {status} memories{layer ? ` in ${LAYER_LABEL[layer]}` : ""}.</p>}
      </section>
    </div>
  );
}

export default function MemoryPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-2 pb-10 pt-2 sm:px-4">
      <TopBar />
      <Suspense>
        <MemoryManager />
      </Suspense>
    </main>
  );
}
