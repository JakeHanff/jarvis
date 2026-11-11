"use client";

import { Cpu, Database, Download, FileUp, KeyRound, Laptop, Plug, ScrollText, ShieldAlert, Smartphone, Sparkles, Tablet, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { ApprovalList } from "@/components/widgets/InsightsWidget";
import { api, getToken, invalidate, setToken } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import type { Action, Conversation, Device, Memory, SystemStatus } from "@/lib/types";

function Card({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass p-5 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold">
        <span className="text-accent">{icon}</span> {title}
      </h2>
      <div className="space-y-3 text-[14px]">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

const SAMPLE = `{
  "format": "jarvis-memory-v1",
  "memories": [
    { "layer": "core_identity", "content": "Prefers conceptual understanding over memorisation", "kind": "stated" },
    { "layer": "life_context", "content": "Currently completing an IB programme", "kind": "stated" }
  ]
}`;

function ImportMemories() {
  const [text, setText] = useState("");
  const [layer, setLayer] = useState("life_context");
  const [review, setReview] = useState(true);
  const [result, setResult] = useState("");
  async function run(payload: unknown) {
    try {
      const r = await api<{ created: number; skipped: unknown[]; status: string }>(
        `/api/import/memories?default_layer=${layer}&review=${review}&source_label=manual`,
        { method: "POST", json: payload },
      );
      setResult(`Imported ${r.created} as “${r.status}”${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}.`);
      invalidate("/api/memories", "/api/insights");
    } catch (e) {
      setResult((e as Error).message);
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-muted">
        Paste a JSON memory profile, a JSON list, or plain lines (one memory per line). Imported items may be outdated, so by default they land in <b>review</b> and nothing is used until
        you keep it.
      </p>
      <textarea className="field min-h-[140px] w-full font-mono text-[12px]" placeholder={SAMPLE} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[13px] text-muted">
          Default layer{" "}
          <select className="field ml-1 text-xs" value={layer} onChange={(e) => setLayer(e.target.value)}>
            {["core_identity", "life_context", "projects_goals", "short_term", "behavioural"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-muted">
          <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} className="accent-[var(--accent)]" /> Review before use
        </label>
        <button
          className="btn btn-primary ml-auto"
          disabled={!text.trim()}
          onClick={() => {
            let payload: unknown;
            try {
              payload = JSON.parse(text);
            } catch {
              payload = text.split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
            }
            run(payload);
          }}
        >
          <FileUp size={14} /> Import
        </button>
      </div>
      {result && <p className="text-[13px] text-accent">{result}</p>}
    </div>
  );
}

function ChatGPTImport() {
  const { data: convs } = useApi<Conversation[]>("/api/conversations?source=import:chatgpt", { interval: 0 });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function upload(file: File) {
    setMsg("Uploading…");
    const fd = new FormData();
    fd.append("file", file);
    const headers: HeadersInit = getToken() ? { Authorization: `Bearer ${getToken()}` } : {};
    const r = await fetch("/api/import/chatgpt-conversations", { method: "POST", body: fd, headers });
    const data = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Imported ${data.imported} conversations (${data.skipped_duplicates} already present).` : (data.detail ?? "Import failed"));
    invalidate("/api/conversations");
  }
  async function distill(c: Conversation) {
    setBusy(c.id);
    try {
      const mems = await api<Memory[]>(`/api/conversations/${c.id}/distill`, { method: "POST" });
      setMsg(`“${c.title}”: ${mems.length} memories proposed — review them in Memory.`);
      invalidate("/api/memories", "/api/insights", "/api/conversations");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-muted">
        In ChatGPT: Settings → Data controls → Export data. Upload the <code className="font-mono">conversations.json</code> from the zip. Transcripts are stored only; use
        <b> Distill</b> to have JARVIS propose memories from a conversation (needs the AI model).
      </p>
      <label className="btn cursor-pointer">
        <FileUp size={14} /> Upload conversations.json
        <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {msg && <p className="text-[13px] text-accent">{msg}</p>}
      {(convs?.length ?? 0) > 0 && (
        <ul className="scroll-thin max-h-64 space-y-1 overflow-y-auto">
          {convs!.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="text-[11px] text-faint">{new Date(c.created_at).toLocaleDateString()}</span>
              <button className="btn !py-0.5 text-xs" disabled={busy === c.id} onClick={() => distill(c)}>
                <Wand2 size={12} /> {busy === c.id ? "…" : "Distill"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DEVICE_ICON: Record<string, React.ReactNode> = { ios: <Smartphone size={14} />, ipados: <Tablet size={14} />, windows: <Laptop size={14} /> };

export default function SettingsPage() {
  const { data: status, error: statusErr } = useApi<SystemStatus>("/api/status", { interval: 30000 });
  const { data: devices } = useApi<Device[]>("/api/devices", { interval: 60000 });
  const { data: actions } = useApi<Action[]>("/api/actions", { interval: 30000 });
  const { raw, put } = useSettings();
  const autonomy = (raw.autonomy as { level: number; paused: boolean; auto_approve_max_risk: string }) ?? { level: 2, paused: false, auto_approve_max_risk: "none" };
  const [token, setTok] = useState("");
  useEffect(() => setTok(getToken()), []);
  const [tokenMsg, setTokenMsg] = useState("");

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
    <main className="mx-auto max-w-[1400px] px-2 pb-10 pt-2 sm:px-4">
      <TopBar />
      <div className="grid gap-[var(--gap)] lg:grid-cols-2">
        <Card title="AI model" icon={<Sparkles size={16} />}>
          {statusErr && <p className="text-danger">{statusErr.message}</p>}
          {status && (
            <>
              <Row k="Status" v={status.ai.configured ? <span className="text-ok">Connected</span> : <span className="text-warn">Not configured</span>} />
              <Row k="Provider" v={status.ai.active ?? "—"} />
              <Row k="Model" v={<code className="font-mono text-[12px]">{status.ai.model ?? "—"}</code>} />
              {!status.ai.configured && (
                <p className="text-[13px] text-muted">
                  Put <code className="font-mono">ANTHROPIC_API_KEY=…</code> in the <code className="font-mono">.env</code> file at the project root, then restart JARVIS. Keys are only ever
                  read by the backend.
                </p>
              )}
            </>
          )}
        </Card>

        <Card title="Storage & sync" icon={<Database size={16} />}>
          {status && (
            <>
              <Row k="Database" v={status.storage.backend} />
              <Row k="Sync" v={status.storage.sync === "cloud" ? <span className="text-ok">Cloud</span> : <span className="text-warn">This machine only</span>} />
              <p className="text-[13px] text-muted">{status.storage.note}</p>
            </>
          )}
        </Card>

        <Card title="Access token" icon={<KeyRound size={16} />}>
          <p className="text-[13px] text-muted">
            {status?.auth.token_required ? "This JARVIS requires an access token." : "No token is required right now."} Set <code className="font-mono">JARVIS_ACCESS_TOKEN</code> in
            <code className="font-mono"> .env</code> before opening JARVIS to other devices, then enter it here once on each device.
          </p>
          <div className="flex gap-1.5">
            <input type="password" className="field flex-1" placeholder="Access token" value={token} onChange={(e) => setTok(e.target.value)} autoComplete="off" />
            <button
              className="btn btn-primary"
              onClick={() => {
                setToken(token.trim());
                setTokenMsg("Saved on this device.");
                invalidate("/api");
              }}
            >
              Save
            </button>
          </div>
          {tokenMsg && <p className="text-[13px] text-accent">{tokenMsg}</p>}
        </Card>

        <Card title="Devices" icon={<Laptop size={16} />}>
          <ul className="space-y-1">
            {(devices ?? []).map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[13px]">
                <span className="text-muted">{DEVICE_ICON[d.platform] ?? <Laptop size={14} />}</span>
                <span className="flex-1">{d.name}</span>
                <span className="text-[11px] text-faint">last seen {new Date(d.last_seen).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-faint">Every browser that opens JARVIS registers itself here.</p>
        </Card>

        <Card title="Autonomy" icon={<Cpu size={16} />}>
          <Row k="Level" v="2 — prepares actions for your approval" />
          <label className="flex items-center justify-between gap-2">
            <span>Pause all assistant suggestions & automations</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={autonomy.paused} onChange={(e) => put("autonomy", { ...autonomy, paused: e.target.checked })} />
          </label>
          <p className="text-[12px] text-faint">In v0.1 nothing runs without your approval. Background automations arrive in Phase 4.</p>
          <div className="label">Awaiting approval</div>
          <ApprovalList />
        </Card>

        <Card title="Integrations" icon={<Plug size={16} />}>
          {status?.integrations.map((i) => (
            <Row key={i.id} k={i.name} v={<span className="text-faint">{i.status.replace("_", " ")} · phase {i.phase}</span>} />
          ))}
        </Card>

        <Card title="Import memory profile" icon={<FileUp size={16} />} className="lg:col-span-2">
          <ImportMemories />
        </Card>

        <Card title="Import ChatGPT history" icon={<FileUp size={16} />} className="lg:col-span-2">
          <ChatGPTImport />
        </Card>

        <Card title="Action log" icon={<ScrollText size={16} />}>
          <ul className="scroll-thin max-h-72 space-y-1 overflow-y-auto">
            {(actions ?? []).map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-[12px]">
                <span className="w-[72px] shrink-0 text-faint">{new Date(a.created_at).toLocaleDateString()}</span>
                <span className="min-w-0 flex-1 truncate">{a.summary || a.skill}</span>
                <span className={a.status === "failed" ? "text-danger" : a.status === "executed" ? "text-ok" : "text-muted"}>{a.status}</span>
              </li>
            ))}
            {actions?.length === 0 && <li className="text-[13px] text-faint">Nothing yet.</li>}
          </ul>
        </Card>

        <Card title="Your data" icon={<ShieldAlert size={16} />}>
          <button className="btn" onClick={exportAll}>
            <Download size={14} /> Export everything (JSON)
          </button>
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] p-3">
            <p className="text-[13px] text-muted">Erase all memories, tasks, events, conversations and settings from this JARVIS. This cannot be undone.</p>
            <button
              className="btn mt-2 !text-danger"
              onClick={async () => {
                const typed = prompt('Type "DELETE-EVERYTHING" to erase all JARVIS data');
                if (typed !== "DELETE-EVERYTHING") return;
                await api(`/api/data?confirm=${encodeURIComponent(typed)}`, { method: "DELETE" });
                invalidate("/api");
              }}
            >
              Erase all data
            </button>
          </div>
        </Card>
      </div>
    </main>
  );
}
