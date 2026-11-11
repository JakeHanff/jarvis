"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { useMediaQuery } from "@/lib/hooks";
import { type LayoutProfile, type WidgetPlacement, useSettings } from "@/lib/settings";
import { SIZE_CLASS, SIZE_LABEL, SIZES, WIDGETS } from "../widgets/registry";

export function useLayoutProfile(): LayoutProfile {
  return useMediaQuery("(max-width: 767px)") ? "mobile" : "desktop";
}

export function Dashboard({ editing }: { editing: boolean }) {
  const { layout, setLayout } = useSettings();
  const profile = useLayoutProfile();
  const current = layout(profile);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function save(widgets: WidgetPlacement[]) {
    setLayout(profile, { widgets });
  }
  function update(id: string, patch: Partial<WidgetPlacement>) {
    save(current.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }
  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    const list = [...current.widgets];
    const from = list.findIndex((w) => w.id === fromId);
    const to = list.findIndex((w) => w.id === toId);
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    save(list);
  }

  const visible = current.widgets.filter((w) => w.visible);
  const hidden = current.widgets.filter((w) => !w.visible);

  return (
    <>
      {editing && (
        <div className="glass mb-[var(--gap)] flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
          <span className="text-muted">
            Editing the <b className="text-fg">{profile}</b> layout — drag widgets to reorder, resize or hide them.
          </span>
          {hidden.length > 0 && <span className="ml-auto text-faint">Hidden:</span>}
          {hidden.map((w) => (
            <button key={w.id} className="btn !py-1 text-xs" onClick={() => update(w.id, { visible: true })}>
              <Eye size={13} /> {WIDGETS[w.type]?.label ?? w.type}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12" style={{ gap: "var(--gap)" }}>
        {visible.map((w) => {
          const def = WIDGETS[w.type];
          if (!def) return null;
          const C = def.component;
          return (
            <div
              key={w.id}
              className={`${SIZE_CLASS[w.size]} min-w-0 transition ${overId === w.id && dragId !== w.id ? "scale-[0.985] opacity-70" : ""} ${dragId === w.id ? "opacity-40" : ""}`}
              draggable={editing}
              onDragStart={(e) => {
                setDragId(w.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!editing) return;
                e.preventDefault();
                setOverId(w.id);
              }}
              onDragLeave={() => setOverId((o) => (o === w.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, w.id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            >
              <C
                frame={{
                  editing,
                  sizeLabel: SIZE_LABEL[w.size],
                  onHide: () => update(w.id, { visible: false }),
                  onResize: () => update(w.id, { size: SIZES[(SIZES.indexOf(w.size) + 1) % SIZES.length] }),
                  className: "h-full",
                }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
