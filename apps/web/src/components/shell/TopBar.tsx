"use client";

import { Brain, LayoutDashboard, LayoutGrid, Palette, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "@/lib/hooks";
import type { SystemStatus } from "@/lib/types";
import { useDeviceHeartbeat } from "./device";

export function TopBar({ onCustomise, editing, onToggleEdit }: { onCustomise?: () => void; editing?: boolean; onToggleEdit?: () => void }) {
  const path = usePathname();
  const { data: status, error } = useApi<SystemStatus>("/api/status", { interval: 60000 });
  useDeviceHeartbeat();

  const online = !error && !!status;
  const dotColor = !online ? "var(--danger)" : status?.ai.configured ? "var(--ok)" : "var(--warn)";
  const dotTitle = !online
    ? error?.code === "unauthorized"
      ? "Access token required — set it in Settings"
      : "Backend unreachable"
    : status?.ai.configured
      ? `Online · ${status.ai.active} · ${status.ai.model}`
      : "Online · AI model not configured";

  const nav = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
    { href: "/memory", label: "Memory", icon: <Brain size={15} /> },
    { href: "/settings", label: "Settings", icon: <Settings size={15} /> },
  ];

  return (
    <header className="glass sticky top-2 z-30 mb-[var(--gap)] flex items-center gap-2 px-3 py-2 sm:px-4">
      <Link href="/" className="flex items-center gap-2.5 pr-2">
        <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
          <defs>
            <linearGradient id="jg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--accent)" />
              <stop offset="1" stopColor="#818cf8" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="20" fill="none" stroke="url(#jg)" strokeWidth="4" />
          <circle cx="32" cy="32" r="8" fill="url(#jg)" />
        </svg>
        <span className="font-display text-[15px] font-semibold tracking-[0.22em]">JARVIS</span>
      </Link>
      <span className="h-2 w-2 rounded-full" style={{ background: dotColor, boxShadow: `0 0 10px ${dotColor}` }} title={dotTitle} aria-label={dotTitle} />
      <nav className="ml-2 hidden items-center gap-0.5 sm:flex">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={`btn btn-ghost !py-1.5 ${path === n.href ? "!bg-hover text-fg" : "text-muted"}`}>
            {n.icon} {n.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        {onToggleEdit && (
          <button className={`btn !py-1.5 ${editing ? "btn-primary" : "btn-ghost text-muted"}`} onClick={onToggleEdit}>
            <LayoutGrid size={15} /> <span className="hidden sm:inline">{editing ? "Done" : "Edit layout"}</span>
          </button>
        )}
        {onCustomise && (
          <button className="btn btn-ghost !py-1.5 text-muted" onClick={onCustomise}>
            <Palette size={15} /> <span className="hidden sm:inline">Customise</span>
          </button>
        )}
        <nav className="flex sm:hidden">
          {nav.slice(1).map((n) => (
            <Link key={n.href} href={n.href} className="icon-btn" aria-label={n.label}>
              {n.icon}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
