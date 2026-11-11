export type TaskKind = "daily" | "long_term" | "goal";

export interface Task {
  id: string;
  title: string;
  notes: string;
  kind: TaskKind;
  status: "open" | "done" | "archived";
  priority: 1 | 2 | 3;
  due_date: string | null;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  progress: number;
  parent_id: string | null;
  sort_order: number;
  source: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type MemoryLayer =
  | "core_identity"
  | "life_context"
  | "projects_goals"
  | "short_term"
  | "behavioural"
  | "assistant_operating";

export interface Memory {
  id: string;
  layer: MemoryLayer;
  category: string;
  content: string;
  kind: "stated" | "inferred" | "observed";
  source: string;
  provenance: Record<string, unknown>;
  confidence: number;
  verification: "unverified" | "user_confirmed" | "user_corrected";
  status: "active" | "proposed" | "superseded" | "rejected" | "archived";
  relevance: number;
  is_temporary: boolean;
  expires_at: string | null;
  review_at: string | null;
  tags: string[];
  related_ids: string[];
  supersedes_id: string | null;
  superseded_by_id: string | null;
  correction_history: { at: string; field: string; old: unknown; new: unknown; note: string }[];
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  source: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  meta: Record<string, unknown> & {
    model?: string;
    notes?: string[];
    proposed_memory_ids?: string[];
    proposed_action_ids?: string[];
  };
  created_at: string;
}

export interface Action {
  id: string;
  actor: string;
  skill: string;
  risk: "low" | "medium" | "high";
  status: "proposed" | "approved" | "rejected" | "executed" | "failed";
  summary: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string;
  origin: Record<string, unknown>;
  created_at: string;
  decided_at: string | null;
}

export interface ChatResponse {
  conversation: Conversation;
  user_message: Message;
  assistant_message: Message;
  proposed_memories: Memory[];
  proposed_actions: Action[];
}

export interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  location: string;
  notes: string;
  source: string;
}

export interface Insight {
  id: string;
  severity: "info" | "warning" | "action" | "setup";
  title: string;
  detail: string;
  reason: string;
  link: string;
}

export interface SystemStatus {
  version: string;
  ai: { configured: boolean; active: string | null; model: string | null; requested: string };
  storage: { backend: string; sync: string; note: string };
  auth: { token_required: boolean };
  integrations: { id: string; name: string; status: string; phase: number }[];
}

export interface Device {
  id: string;
  name: string;
  platform: string;
  capabilities: string[];
  first_seen: string;
  last_seen: string;
}
