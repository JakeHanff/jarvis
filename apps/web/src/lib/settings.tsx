"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, fileUrl } from "./api";
import { useApi } from "./hooks";

// ---------------------------------------------------------------- appearance
export type ThemeMode = "dark" | "light" | "system";
export interface Appearance {
  theme: ThemeMode;
  accent: string; // hex
  wallpaper: { kind: "preset" | "url" | "upload" | "none"; value: string };
  glass: number; // panel opacity 0.15 - 0.95
  blur: number; // px
  dim: number; // wallpaper darkening 0 - 0.8
  density: "compact" | "comfortable";
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "dark",
  accent: "#5eead4",
  wallpaper: { kind: "preset", value: "aurora" },
  glass: 0.55,
  blur: 18,
  dim: 0.15,
  density: "comfortable",
};

export const WALLPAPER_PRESETS: Record<string, { label: string; css: string; light?: boolean }> = {
  aurora: {
    label: "Aurora",
    css: "radial-gradient(1200px 700px at 12% 8%, rgba(45,212,191,.28), transparent 60%), radial-gradient(900px 600px at 88% 18%, rgba(129,140,248,.26), transparent 60%), radial-gradient(1000px 800px at 60% 110%, rgba(236,72,153,.16), transparent 60%), linear-gradient(160deg, #05070d 0%, #0a1020 55%, #070a12 100%)",
  },
  nebula: {
    label: "Nebula",
    css: "radial-gradient(900px 600px at 80% 0%, rgba(168,85,247,.35), transparent 60%), radial-gradient(800px 700px at 0% 100%, rgba(59,130,246,.28), transparent 60%), linear-gradient(180deg, #08060f, #0d0a1a)",
  },
  graphite: {
    label: "Graphite",
    css: "radial-gradient(1000px 600px at 50% -10%, rgba(255,255,255,.08), transparent 60%), linear-gradient(180deg, #0b0c0e, #111316)",
  },
  ember: {
    label: "Ember",
    css: "radial-gradient(900px 600px at 10% 0%, rgba(251,146,60,.28), transparent 60%), radial-gradient(800px 600px at 100% 100%, rgba(244,63,94,.22), transparent 60%), linear-gradient(180deg, #0e0907, #140c0a)",
  },
  dawn: {
    label: "Dawn",
    light: true,
    css: "radial-gradient(1000px 600px at 0% 0%, rgba(125,211,252,.45), transparent 60%), radial-gradient(900px 700px at 100% 20%, rgba(253,186,116,.40), transparent 60%), linear-gradient(180deg, #f6f7fb, #eef1f7)",
  },
  paper: {
    label: "Paper",
    light: true,
    css: "linear-gradient(180deg, #f7f6f3, #efede8)",
  },
};

export const ACCENTS = ["#5eead4", "#7dd3fc", "#a78bfa", "#f0abfc", "#fda4af", "#fdba74", "#fde047", "#86efac", "#e5e7eb"];

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return "94 234 212";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function wallpaperCss(a: Appearance): string {
  const w = a.wallpaper;
  if (w.kind === "preset") return (WALLPAPER_PRESETS[w.value] ?? WALLPAPER_PRESETS.aurora).css;
  if ((w.kind === "url" || w.kind === "upload") && w.value) return `url("${fileUrl(w.value).replace(/"/g, "%22")}") center / cover no-repeat`;
  return "none";
}

function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  let theme = a.theme;
  if (theme === "system") theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  root.dataset.theme = theme;
  root.dataset.density = a.density;
  root.style.setProperty("--accent", a.accent);
  root.style.setProperty("--accent-rgb", hexToRgb(a.accent));
  root.style.setProperty("--glass", String(a.glass));
  root.style.setProperty("--blur", `${a.blur}px`);
  root.style.setProperty("--dim", String(a.dim));
  root.style.setProperty("--wallpaper", wallpaperCss(a));
}

// ---------------------------------------------------------------- layout
export type WidgetType = "assistant" | "overview" | "calendar" | "tasks" | "goals" | "memory" | "insights";
export type WidgetSize = "sm" | "md" | "lg" | "xl" | "full";
export interface WidgetPlacement {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  visible: boolean;
}
export interface Layout {
  widgets: WidgetPlacement[];
}
export type LayoutProfile = "desktop" | "mobile";

export const DEFAULT_LAYOUTS: Record<LayoutProfile, Layout> = {
  desktop: {
    widgets: [
      { id: "overview", type: "overview", size: "xl", visible: true },
      { id: "insights", type: "insights", size: "md", visible: true },
      { id: "assistant", type: "assistant", size: "lg", visible: true },
      { id: "tasks", type: "tasks", size: "sm", visible: true },
      { id: "calendar", type: "calendar", size: "sm", visible: true },
      { id: "goals", type: "goals", size: "md", visible: true },
      { id: "memory", type: "memory", size: "xl", visible: true },
    ],
  },
  mobile: {
    widgets: [
      { id: "overview", type: "overview", size: "full", visible: true },
      { id: "insights", type: "insights", size: "full", visible: true },
      { id: "tasks", type: "tasks", size: "full", visible: true },
      { id: "assistant", type: "assistant", size: "full", visible: true },
      { id: "calendar", type: "calendar", size: "full", visible: true },
      { id: "goals", type: "goals", size: "full", visible: true },
      { id: "memory", type: "memory", size: "full", visible: true },
    ],
  },
};

/** Merge a stored layout with defaults so widgets added in new versions appear. */
function normaliseLayout(stored: Layout | undefined, profile: LayoutProfile): Layout {
  const defaults = DEFAULT_LAYOUTS[profile];
  if (!stored?.widgets?.length) return defaults;
  const seen = new Set(stored.widgets.map((w) => w.type));
  return { widgets: [...stored.widgets, ...defaults.widgets.filter((w) => !seen.has(w.type)).map((w) => ({ ...w, visible: false }))] };
}

export interface Preset {
  name: string;
  appearance: Appearance;
  layouts: Partial<Record<LayoutProfile, Layout>>;
  saved_at: string;
}

// ---------------------------------------------------------------- context
type AllSettings = Record<string, unknown> & {
  appearance?: Partial<Appearance>;
  presets?: { items: Preset[] };
  autonomy?: { level: number; paused: boolean; auto_approve_max_risk: string };
};

interface Ctx {
  loaded: boolean;
  error: string | null;
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
  layout: (p: LayoutProfile) => Layout;
  setLayout: (p: LayoutProfile, l: Layout) => void;
  raw: AllSettings;
  put: (key: string, value: unknown) => Promise<void>;
}

const SettingsCtx = createContext<Ctx | null>(null);
const CACHE_KEY = "jarvis.appearanceCache";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data, error } = useApi<AllSettings>("/api/settings", { interval: 30000 });
  const [local, setLocal] = useState<AllSettings>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // Server values win when they arrive; local holds optimistic edits.
  useEffect(() => {
    if (data) setLocal(data);
  }, [data]);

  const appearance = useMemo<Appearance>(() => {
    const a = { ...DEFAULT_APPEARANCE, ...(local.appearance ?? {}) };
    a.wallpaper = { ...DEFAULT_APPEARANCE.wallpaper, ...(local.appearance?.wallpaper ?? {}) };
    return a;
  }, [local.appearance]);

  // Apply cached appearance immediately to avoid a flash before the API answers.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) applyAppearance({ ...DEFAULT_APPEARANCE, ...JSON.parse(cached) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    applyAppearance(appearance);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(appearance));
    } catch {
      /* ignore */
    }
    if (appearance.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const fn = () => applyAppearance(appearance);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [appearance]);

  const put = useCallback(async (key: string, value: unknown) => {
    setLocal((s) => ({ ...s, [key]: value }));
    try {
      await api(`/api/settings/${key}`, { method: "PUT", json: { value } });
      setSaveError(null);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }, []);

  const value: Ctx = {
    loaded: data !== undefined,
    error: saveError ?? (error ? error.message : null),
    appearance,
    setAppearance: (patch) => put("appearance", { ...appearance, ...patch }),
    layout: (p) => normaliseLayout(local[`layout:${p}`] as Layout | undefined, p),
    setLayout: (p, l) => put(`layout:${p}`, l),
    raw: local,
    put,
  };
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
