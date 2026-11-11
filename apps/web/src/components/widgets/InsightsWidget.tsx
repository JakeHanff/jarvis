"use client";

import { AlertTriangle, Bell, Check, Info, Settings2, Sparkle, X } from "lucide-react";
import Link from "next/link";
import { api, invalidate, localTimezone } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Action, Insight } from "@/lib/types";
import { Empty, ErrorNote, WidgetFrame } from "./WidgetFrame";
import type { WidgetProps } from "./types";

const ICON = {
  warning: <AlertTriangle size={14} className="text-warn" />,
  info: <Info size={14} className="text-muted" />,
  action: <Sparkle size={14} className="text-accent" />,
  setup: <Settings2 size={14} className="text-muted" />,
};

const HREF: Record<string, string> = { memory: "/memory", settings: "/settings" };

export function ApprovalList({ compact = false }: { compact?: boolean }) {
  const { data } = useApi<Action[]>("/api/actions?status=proposed", { interval: 15000 });
  if (!data?.length) return compact ? null : <Empty>No suggested actions.</Empty>;
  async function decide(a: Action, verdict: "approve" | "reject") {
    await api(`/api/actions/${a.id}/${verdict}`, { method: "POST" });
    invalidate("/api/actions", "/api/insights", "/api/tasks", "/api/events");
  }
  return (
    <ul className="space-y-1.5">
      {data.map((a) => (
        <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px]">{a.summary}</div>
            <div className="text-[11px] text-faint">
              {a.skill} · {a.risk} risk · suggested by {a.actor}
            </div>
          </div>
          <button className="icon-btn !h-7 !w-7 hover:!text-ok" onClick={() => decide(a, "approve")} aria-label="Approve">
            <Check size={15} />
          </button>
          <button className="icon-btn !h-7 !w-7 hover:!text-danger" onClick={() => decide(a, "reject")} aria-label="Reject">
            <X size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function InsightsWidget(props: WidgetProps) {
  const tz = localTimezone();
  const { data, error } = useApi<Insight[]>(`/api/insights${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, { interval: 30000 });
  const items = (data ?? []).filter((i) => i.id !== "approvals");
  const hasApprovals = (data ?? []).some((i) => i.id === "approvals");

  return (
    <WidgetFrame {...props.frame} title="Insights" icon={<Bell size={15} />} actions={data?.length ? <span className="chip">{data.length}</span> : null}>
      {error && <ErrorNote message={error.message} />}
      {hasApprovals && (
        <div className="mb-3">
          <div className="label mb-1.5">Awaiting your approval</div>
          <ApprovalList compact />
        </div>
      )}
      <ul className="scroll-thin max-h-[320px] space-y-1 overflow-y-auto">
        {items.map((i) => {
          const body = (
            <div className="flex gap-2.5 rounded-lg px-1.5 py-2 hover:bg-hover" title={`Why: ${i.reason}`}>
              <span className="mt-0.5">{ICON[i.severity]}</span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{i.title}</div>
                {i.detail && <div className="line-clamp-2 text-[12px] text-muted">{i.detail}</div>}
              </div>
            </div>
          );
          return <li key={i.id}>{HREF[i.link] ? <Link href={HREF[i.link]}>{body}</Link> : body}</li>;
        })}
        {data && data.length === 0 && <Empty>All clear. Nothing needs your attention.</Empty>}
      </ul>
    </WidgetFrame>
  );
}
