"use client";

import { GripVertical, EyeOff, Maximize2 } from "lucide-react";
import type { ReactNode } from "react";

export function WidgetFrame({
  title,
  icon,
  actions,
  children,
  editing,
  onHide,
  onResize,
  sizeLabel,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  editing?: boolean;
  onHide?: () => void;
  onResize?: () => void;
  sizeLabel?: string;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`glass flex min-h-0 flex-col ${editing ? "ring-1 ring-[rgb(var(--accent-rgb)/0.5)]" : ""} ${className}`}
      style={{ padding: "var(--pad)" }}
    >
      <header className="mb-3 flex items-center gap-2">
        {editing && <GripVertical size={16} className="cursor-grab text-faint" aria-label="Drag to move" />}
        {icon && <span className="text-accent">{icon}</span>}
        <h2 className="font-display text-[13px] font-semibold tracking-wide text-fg/90">{title}</h2>
        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <>
              <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={onResize} title="Change width">
                <Maximize2 size={13} /> {sizeLabel}
              </button>
              <button className="icon-btn" onClick={onHide} title="Hide widget" aria-label="Hide widget">
                <EyeOff size={15} />
              </button>
            </>
          ) : (
            actions
          )}
        </div>
      </header>
      <div className={`min-h-0 flex-1 ${editing ? "pointer-events-none select-none opacity-60" : ""} ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-center text-[13px] text-faint">{children}</p>;
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] px-3 py-2 text-[12px] text-danger">{message}</p>;
}
