"use client";

import { AlertCircle, BookmarkPlus, Bot, Check, History, Maximize2, Minimize2, Plus, SendHorizontal, ThumbsDown, ThumbsUp, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, invalidate, localTimezone } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Action, ChatResponse, Conversation, Memory, Message, SystemStatus } from "@/lib/types";
import { Markdown } from "../Markdown";
import { LAYER_LABEL } from "../memory/MemoryCard";
import { WidgetFrame } from "./WidgetFrame";
import type { WidgetProps } from "./types";

const MODES = ["auto", "casual", "academic", "strategic", "executive", "research"] as const;
type Mode = (typeof MODES)[number];
const CONV_KEY = "jarvis.currentConversation";

function readConv(): string | null {
  try {
    return localStorage.getItem(CONV_KEY);
  } catch {
    return null;
  }
}
function writeConv(id: string | null) {
  try {
    if (id) localStorage.setItem(CONV_KEY, id);
    else localStorage.removeItem(CONV_KEY);
  } catch {
    /* ignore */
  }
}

function Proposals({ memories, actions }: { memories: Memory[]; actions: Action[] }) {
  const [done, setDone] = useState<Record<string, string>>({});
  if (!memories.length && !actions.length) return null;
  async function act(key: string, url: string, label: string) {
    try {
      await api(url, { method: "POST" });
      setDone((d) => ({ ...d, [key]: label }));
      invalidate("/api/memories", "/api/actions", "/api/tasks", "/api/insights");
    } catch (e) {
      setDone((d) => ({ ...d, [key]: (e as Error).message }));
    }
  }
  return (
    <div className="mt-2 space-y-1.5">
      {memories.map((m) => (
        <div key={m.id} className="flex items-center gap-2 rounded-lg border border-[rgb(var(--accent-rgb)/0.3)] px-2.5 py-1.5 text-[12px]">
          <BookmarkPlus size={13} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="text-muted">Remember ({LAYER_LABEL[m.layer]}, {m.kind}):</span> {m.content}
          </span>
          {done[m.id] ? (
            <span className="text-faint">{done[m.id]}</span>
          ) : (
            <>
              <button className="icon-btn !h-6 !w-6 hover:!text-ok" onClick={() => act(m.id, `/api/memories/${m.id}/confirm`, "Kept")} aria-label="Keep memory">
                <Check size={13} />
              </button>
              <button className="icon-btn !h-6 !w-6 hover:!text-danger" onClick={() => act(m.id, `/api/memories/${m.id}/reject`, "Discarded")} aria-label="Discard memory">
                <X size={13} />
              </button>
            </>
          )}
        </div>
      ))}
      {actions.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12px]">
          <Plus size={13} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">{a.summary}</span>
          {done[a.id] ? (
            <span className="text-faint">{done[a.id]}</span>
          ) : (
            <>
              <button className="icon-btn !h-6 !w-6 hover:!text-ok" onClick={() => act(a.id, `/api/actions/${a.id}/approve`, "Added")} aria-label="Approve">
                <Check size={13} />
              </button>
              <button className="icon-btn !h-6 !w-6 hover:!text-danger" onClick={() => act(a.id, `/api/actions/${a.id}/reject`, "Dismissed")} aria-label="Dismiss">
                <X size={13} />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function FeedbackBar({ msg }: { msg: Message }) {
  const [sent, setSent] = useState<string | null>(null);
  async function send(kind: string) {
    await api("/api/feedback", { method: "POST", json: { target_type: "message", target_id: msg.id, kind } });
    setSent(kind);
    if (kind === "remember" || kind === "do_not_remember") invalidate("/api/memories", "/api/insights");
  }
  const btn = (kind: string, icon: React.ReactNode, label: string) => (
    <button className={`icon-btn !h-6 !w-6 ${sent === kind ? "!text-accent" : ""}`} onClick={() => send(kind)} title={label} aria-label={label} disabled={!!sent}>
      {icon}
    </button>
  );
  if (msg.role === "user")
    return <div className="flex justify-end opacity-0 transition group-hover:opacity-100">{btn("remember", <BookmarkPlus size={12} />, sent ? "Saved to memory" : "Remember this")}</div>;
  return (
    <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
      {btn("useful", <ThumbsUp size={12} />, "Useful")}
      {btn("not_useful", <ThumbsDown size={12} />, "Not useful")}
      {btn("incorrect", <XCircle size={12} />, "Incorrect")}
      {(msg.meta?.proposed_memory_ids?.length ?? 0) > 0 && btn("do_not_remember", <X size={12} />, "Don’t remember anything from this")}
      {sent && <span className="ml-1 text-[11px] text-faint">Thanks — noted</span>}
      {msg.meta?.model && <span className="ml-auto text-[10px] text-faint">{String(msg.meta.model)}</span>}
    </div>
  );
}

export function AssistantWidget(props: WidgetProps) {
  const { data: status } = useApi<SystemStatus>("/api/status", { interval: 60000 });
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposals, setProposals] = useState<Record<string, { memories: Memory[]; actions: Action[] }>>({});
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { data: convs } = useApi<Conversation[]>(showHistory ? "/api/conversations?source=jarvis" : null, { interval: 0 });
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => setConvId(readConv()), []);

  useEffect(() => {
    if (!convId) {
      setMessages([]);
      return;
    }
    api<Message[]>(`/api/conversations/${convId}/messages`)
      .then(setMessages)
      .catch((e: ApiError) => {
        if (e.status === 404) {
          writeConv(null);
          setConvId(null);
        }
      });
  }, [convId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const aiReady = status?.ai.configured ?? false;

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const temp: Message = { id: `tmp-${Date.now()}`, conversation_id: convId ?? "", role: "user", content: text, meta: {}, created_at: new Date().toISOString() };
    setMessages((m) => [...m, temp]);
    setInput("");
    try {
      const r = await api<ChatResponse>("/api/chat", { method: "POST", json: { message: text, conversation_id: convId, mode, timezone: localTimezone() } });
      if (r.conversation.id !== convId) {
        setConvId(r.conversation.id);
        writeConv(r.conversation.id);
      }
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), r.user_message, r.assistant_message]);
      setProposals((p) => ({ ...p, [r.assistant_message.id]: { memories: r.proposed_memories, actions: r.proposed_actions } }));
      if (r.proposed_memories.length || r.proposed_actions.length) invalidate("/api/memories", "/api/actions", "/api/insights");
    } catch (e) {
      setError(e as ApiError);
      // Keep the typed text so nothing is lost.
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function newChat() {
    writeConv(null);
    setConvId(null);
    setMessages([]);
    setError(null);
    setShowHistory(false);
  }

  const body = (
    <div className={`flex min-h-0 flex-col ${expanded ? "h-full" : "h-[460px]"}`}>
      {status && !aiReady && (
        <div className="mb-2 flex gap-2 rounded-lg border border-line bg-hover px-3 py-2 text-[12px] text-muted">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-warn" />
          <span>
            <b className="text-fg">AI model not connected.</b> Add <code className="font-mono">ANTHROPIC_API_KEY</code> to <code className="font-mono">.env</code> and restart the
            backend. Everything else on the dashboard works without it.
          </span>
        </div>
      )}
      {showHistory && (
        <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border border-line p-1">
          {(convs ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setConvId(c.id);
                writeConv(c.id);
                setShowHistory(false);
              }}
              className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover ${c.id === convId ? "text-accent" : ""}`}
            >
              {c.title} <span className="text-[11px] text-faint">· {new Date(c.updated_at).toLocaleDateString()}</span>
            </button>
          ))}
          {convs && convs.length === 0 && <p className="p-2 text-[12px] text-faint">No conversations yet.</p>}
        </div>
      )}
      <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && !sending && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl accent-soft">
                <Bot size={22} />
              </div>
              <p className="font-display text-lg">What are we working on?</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">
                JARVIS uses your memories, tasks and calendar as context. It will push back when it disagrees — and suggest things to remember, which you approve.
              </p>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`group rise ${m.role === "user" ? "ml-auto max-w-[85%]" : "max-w-full"}`}>
            {m.role === "user" ? (
              <div className="rounded-2xl rounded-br-md bg-[rgb(var(--accent-rgb)/0.16)] px-3.5 py-2 text-[14px] whitespace-pre-wrap">{m.content}</div>
            ) : (
              <div className="flex gap-2.5">
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg accent-soft">
                  <Bot size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <Markdown text={m.content} />
                  {(m.meta?.notes?.length ?? 0) > 0 && <p className="mt-1 text-[11px] text-warn">{m.meta.notes!.join(" ")}</p>}
                  {proposals[m.id] && <Proposals {...proposals[m.id]} />}
                </div>
              </div>
            )}
            <div className="mt-1">{!m.id.startsWith("tmp-") && <FeedbackBar msg={m} />}</div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2.5">
            <div className="grid h-6 w-6 place-items-center rounded-lg accent-soft">
              <Bot size={13} />
            </div>
            <div className="typing flex gap-1 text-accent">
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] px-3 py-2 text-[12px] text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error.message}</span>
        </div>
      )}
      <div className="mt-3">
        <div className="mb-1.5 flex flex-wrap gap-1">
          {MODES.map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-full px-2.5 py-0.5 text-[11px] capitalize ${mode === m ? "accent-soft" : "text-muted hover:text-fg"}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-xl border border-line bg-hover p-1.5 focus-within:border-[rgb(var(--accent-rgb)/0.5)]">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={aiReady ? "Message JARVIS…  (Shift+Enter for a new line)" : "Connect an AI model to chat"}
            className="scroll-thin max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] outline-none placeholder:text-faint"
            aria-label="Message JARVIS"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button className="btn btn-primary !h-9 !px-3" onClick={send} disabled={!input.trim() || sending || !aiReady} aria-label="Send">
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  const actions = (
    <>
      <button className={`icon-btn ${showHistory ? "!text-accent" : ""}`} onClick={() => setShowHistory((s) => !s)} title="Conversations" aria-label="Conversations">
        <History size={15} />
      </button>
      <button className="icon-btn" onClick={newChat} title="New conversation" aria-label="New conversation">
        <Plus size={15} />
      </button>
      <button className="icon-btn" onClick={() => setExpanded((e) => !e)} title={expanded ? "Exit full screen (Esc)" : "Full screen"} aria-label="Toggle full screen">
        {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>
    </>
  );

  if (expanded) {
    return (
      <>
        <WidgetFrame {...props.frame} title="JARVIS" icon={<Bot size={15} />}>
          <p className="py-10 text-center text-[13px] text-faint">Open in full screen</p>
        </WidgetFrame>
        <div className="fixed inset-0 z-50 bg-black/40 p-3 backdrop-blur-sm sm:p-6">
          <div className="glass-strong mx-auto flex h-full max-w-4xl flex-col" style={{ padding: "var(--pad)" }}>
            <header className="mb-3 flex items-center gap-2">
              <Bot size={15} className="text-accent" />
              <h2 className="font-display text-[13px] font-semibold">JARVIS</h2>
              <div className="ml-auto flex">{actions}</div>
            </header>
            <div className="min-h-0 flex-1">{body}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <WidgetFrame {...props.frame} title="JARVIS" icon={<Bot size={15} />} actions={actions}>
      {body}
    </WidgetFrame>
  );
}
