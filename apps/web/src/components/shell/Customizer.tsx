"use client";

import { Check, ImageUp, Monitor, Moon, RotateCcw, Save, Sun, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { getToken } from "@/lib/api";
import {
  ACCENTS,
  DEFAULT_APPEARANCE,
  DEFAULT_LAYOUTS,
  type Preset,
  type ThemeMode,
  WALLPAPER_PRESETS,
  useSettings,
} from "@/lib/settings";
import { useLayoutProfile } from "./Dashboard";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="label">{title}</h3>
      {children}
    </section>
  );
}

function Slider({ label, cssVar, unit = "", value, min, max, step, onChange, fmt }: { label: string; cssVar: string; unit?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  const [v, setV] = useState(value);
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="font-mono text-muted">{fmt(v)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => {
          setV(Number(e.target.value));
          // live preview; persisted on release
          document.documentElement.style.setProperty(cssVar, `${e.target.value}${unit}`);
        }}
        onPointerUp={() => onChange(v)}
        onKeyUp={() => onChange(v)}
        className="w-full accent-[var(--accent)]"
      />
    </label>
  );
}

export function Customizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appearance: a, setAppearance, raw, put, layout, setLayout } = useSettings();
  const profile = useLayoutProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(a.wallpaper.kind === "url" ? a.wallpaper.value : "");
  const [uploadErr, setUploadErr] = useState("");
  const [presetName, setPresetName] = useState("");
  const presets: Preset[] = (raw.presets as { items: Preset[] } | undefined)?.items ?? [];

  if (!open) return null;

  async function upload(file: File) {
    setUploadErr("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const headers: HeadersInit = getToken() ? { Authorization: `Bearer ${getToken()}` } : {};
      const r = await fetch("/api/uploads", { method: "POST", body: fd, headers });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Upload failed");
      setAppearance({ wallpaper: { kind: "upload", value: data.url } });
    } catch (e) {
      setUploadErr((e as Error).message);
    }
  }

  function savePreset() {
    const name = presetName.trim() || `Preset ${presets.length + 1}`;
    const item: Preset = { name, appearance: a, layouts: { desktop: layout("desktop"), mobile: layout("mobile") }, saved_at: new Date().toISOString() };
    put("presets", { items: [...presets.filter((p) => p.name !== name), item] });
    setPresetName("");
  }
  function applyPreset(p: Preset) {
    put("appearance", p.appearance);
    if (p.layouts.desktop) setLayout("desktop", p.layouts.desktop);
    if (p.layouts.mobile) setLayout("mobile", p.layouts.mobile);
  }

  const themeBtn = (t: ThemeMode, icon: React.ReactNode, label: string) => (
    <button onClick={() => setAppearance({ theme: t })} className={`btn flex-1 justify-center ${a.theme === t ? "!border-[rgb(var(--accent-rgb)/0.6)] accent-soft" : ""}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-label="Customise dashboard">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />
      <aside className="glass-strong scroll-thin relative m-2 flex w-full max-w-[380px] flex-col gap-6 overflow-y-auto !rounded-2xl p-5">
        <header className="flex items-center">
          <h2 className="font-display text-lg font-semibold">Customise</h2>
          <button className="icon-btn ml-auto" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <Section title="Theme">
          <div className="flex gap-1.5">
            {themeBtn("dark", <Moon size={14} />, "Dark")}
            {themeBtn("light", <Sun size={14} />, "Light")}
            {themeBtn("system", <Monitor size={14} />, "Auto")}
          </div>
        </Section>

        <Section title="Accent colour">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setAppearance({ accent: c })} className="grid h-8 w-8 place-items-center rounded-full border border-line-strong" style={{ background: c }} aria-label={`Accent ${c}`}>
                {a.accent.toLowerCase() === c && <Check size={14} className="text-black" />}
              </button>
            ))}
            <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-dashed border-line-strong" title="Custom colour">
              <input type="color" value={a.accent} onChange={(e) => setAppearance({ accent: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              <span className="grid h-full place-items-center text-[10px] text-muted">+</span>
            </label>
          </div>
        </Section>

        <Section title="Wallpaper">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(WALLPAPER_PRESETS).map(([k, p]) => (
              <button
                key={k}
                onClick={() => setAppearance({ wallpaper: { kind: "preset", value: k }, ...(p.light && a.theme === "dark" ? { theme: "light" } : !p.light && a.theme === "light" ? { theme: "dark" } : {}) })}
                className={`h-16 rounded-xl border text-[11px] font-medium ${a.wallpaper.kind === "preset" && a.wallpaper.value === k ? "border-accent ring-1 ring-accent" : "border-line"}`}
                style={{ background: p.css, color: p.light ? "#111" : "#fff" }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setAppearance({ wallpaper: { kind: "none", value: "" } })}
              className={`h-16 rounded-xl border bg-bg text-[11px] ${a.wallpaper.kind === "none" ? "border-accent ring-1 ring-accent" : "border-line"}`}
            >
              Solid
            </button>
            <button onClick={() => fileRef.current?.click()} className={`grid h-16 place-items-center rounded-xl border border-dashed text-[11px] ${a.wallpaper.kind === "upload" ? "border-accent" : "border-line-strong"}`}>
              <span className="flex flex-col items-center gap-1">
                <ImageUp size={15} /> Upload
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
          {uploadErr && <p className="text-[12px] text-danger">{uploadErr}</p>}
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^https:\/\//.test(url)) setAppearance({ wallpaper: { kind: "url", value: url } });
            }}
          >
            <input className="field flex-1" placeholder="…or an https:// image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn" disabled={!/^https:\/\//.test(url)}>
              Use
            </button>
          </form>
          <Slider label="Wallpaper dim" cssVar="--dim" value={a.dim} min={0} max={0.8} step={0.05} onChange={(v) => setAppearance({ dim: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        </Section>

        <Section title="Panels">
          <Slider label="Panel opacity" cssVar="--glass" value={a.glass} min={0.15} max={0.95} step={0.05} onChange={(v) => setAppearance({ glass: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Blur" cssVar="--blur" unit="px" value={a.blur} min={0} max={40} step={2} onChange={(v) => setAppearance({ blur: v })} fmt={(v) => `${v}px`} />
          <div className="flex gap-1.5">
            {(["comfortable", "compact"] as const).map((d) => (
              <button key={d} onClick={() => setAppearance({ density: d })} className={`btn flex-1 justify-center capitalize ${a.density === d ? "accent-soft !border-[rgb(var(--accent-rgb)/0.6)]" : ""}`}>
                {d}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Presets">
          <div className="flex gap-1.5">
            <input className="field flex-1" placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
            <button className="btn" onClick={savePreset}>
              <Save size={14} /> Save
            </button>
          </div>
          <ul className="space-y-1">
            {presets.map((p) => (
              <li key={p.name} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[13px]">
                <span className="h-4 w-4 rounded-full" style={{ background: p.appearance.accent }} />
                <span className="flex-1 truncate">{p.name}</span>
                <button className="btn !py-0.5 text-xs" onClick={() => applyPreset(p)}>
                  Apply
                </button>
                <button className="icon-btn !h-6 !w-6" onClick={() => put("presets", { items: presets.filter((x) => x.name !== p.name) })} aria-label="Delete preset">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-1.5">
            <button className="btn flex-1 justify-center" onClick={() => put("appearance", DEFAULT_APPEARANCE)}>
              <RotateCcw size={13} /> Reset look
            </button>
            <button className="btn flex-1 justify-center" onClick={() => setLayout(profile, DEFAULT_LAYOUTS[profile])}>
              <RotateCcw size={13} /> Reset {profile} layout
            </button>
          </div>
        </Section>
        <p className="text-[11px] text-faint">Appearance and layouts are stored in JARVIS and follow you to every device. Phones use a separate “mobile” layout.</p>
      </aside>
    </div>
  );
}
