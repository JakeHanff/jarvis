# Architecture

## Overview

```
 Browser / PWA (laptop, iPhone, iPad)
        │  same-origin requests to /api/*
        ▼
 Next.js (apps/web) ── rewrites /api/* ──►  FastAPI (services/api)
   dashboard UI, widgets,                    ├─ routers/       HTTP API
   theming, layout                           ├─ memory_service retrieval, corrections
                                             ├─ ai/            providers, prompt, orchestrator
                                             ├─ skills/        capability registry + approvals
                                             └─ models.py      SQLAlchemy tables
                                                   │
                                                   ▼
                                     SQLite (data/jarvis.db)  or  Supabase Postgres (DATABASE_URL)
                                                   │
                                     Anthropic / OpenAI APIs (keys only on the backend)
```

The browser never talks to the model provider or the database directly. Secrets live only in `.env`, read by the backend.

## Why this shape

- **Next.js proxies the API.** One origin for the browser (no CORS, one URL for phones). The backend binds to `127.0.0.1` only; LAN devices reach it through Next.js.
- **FastAPI owns all logic.** AI orchestration, memory rules and the approval queue need a long-lived server process (not the browser) and Python is the better ecosystem for later AI work (embeddings, document parsing, scheduling).
- **SQLAlchemy over SQLite *or* Postgres.** Same models and code run locally with zero setup, and in the cloud on Supabase by changing `DATABASE_URL`. JSON columns use the generic JSON type; ids are UUID strings; datetimes are always UTC-aware (`UTCDateTime`).
- **Every row has `user_id`.** v0.1 is single-user (`JARVIS_USER_ID`), but multi-device auth via Supabase can switch on without reshaping data.

## Backend modules

| Module | Responsibility |
|---|---|
| `config.py` | Settings from env/.env. |
| `db.py` | Engine/session; `create_all` on startup; RLS on for Postgres. |
| `models.py` | Tables: tasks, memories, conversations, messages, calendar_events, user_settings, feedback, action_log, devices. |
| `memory_service.py` | Retrieval for chat context, correction history, search. |
| `ai/providers.py` | `ChatProvider` protocol; `AnthropicProvider` (official SDK, prompt caching, server-side refusal fallback) and `OpenAIProvider` (HTTP). `get_provider()` returns `None` when unconfigured — the API then returns 503, never a fake reply. |
| `ai/prompt.py` | Stable system prompt (cacheable) + per-request dynamic context; parses `<jarvis_proposals>`. |
| `ai/orchestrator.py` | One chat turn: retrieve memories/tasks/events → call model → store → file proposals. |
| `skills/` | Skill registry: name, JSON-schema inputs, risk, permissions, handler. `propose` / `execute` write to `action_log`. |
| `routers/` | tasks, memories, chat/conversations, events, system (settings, insights, actions, feedback, devices, uploads, import/export, status). |

### Chat turn

1. Retrieve memories: all active *core identity* + keyword-matched others (+ life context). Proposed/rejected/superseded/expired memories are excluded.
2. Build the dynamic system block: local date/time (from the browser's timezone), memories labelled stated/inferred + confidence, open tasks, next 7 days of local events.
3. Call the provider with the stable system block first (cached) and the last 30 turns.
4. Strip the optional `<jarvis_proposals>{...}</jarvis_proposals>` block. Memory proposals are stored with `status=proposed`; task proposals become `action_log` rows with `status=proposed`. Nothing takes effect until the user approves. If autonomy is paused, proposals are dropped.

Why a text block instead of tool use for proposals: it works identically across providers and with a single request. Phase 2 moves to native tool use via the same skill registry (input schemas are already tool-shaped).

### Memory retrieval (v0.1 → planned)

v0.1 uses keyword overlap weighted by layer and relevance. This is deliberately simple and is the first thing to upgrade: add an `embedding vector(…)` column with pgvector on Supabase and replace `retrieve_for_context` internals; its signature stays the same.

## Frontend

- `lib/api.ts` — fetch wrapper (bearer token from localStorage), error normalisation, invalidation bus.
- `lib/hooks.ts` — `useApi` refetches on invalidation, window focus and an interval (this is how changes from another device appear).
- `lib/settings.tsx` — `SettingsProvider`: appearance + layouts stored server-side under `appearance`, `layout:desktop`, `layout:mobile`, `presets`. Appearance is applied as CSS variables on `<html>`.
- `components/widgets/registry.tsx` — the widget registry. Adding a widget = one component + one entry. Layout entries are `{id, type, size, visible}`; sizes map to a 12-column grid (6 on tablets, 1 on phones).
- Design tokens live in `app/globals.css` (`--accent`, `--glass`, `--blur`, `--dim`, `--wallpaper`, density vars) and are exposed to Tailwind via `@theme inline`.

## Data flow for cross-device use

Today: all devices → one backend → one database. With SQLite the backend must be running on the laptop. With `DATABASE_URL` pointing at Supabase *and* the backend hosted (planned), the laptop can be off.

## Extension points

| Want to add | Where |
|---|---|
| A model provider | class in `ai/providers.py` + branch in `get_provider` |
| A skill / integration action | `register(Skill(...))`; set `requires_integration` |
| A dashboard widget | component in `components/widgets/`, entry in `registry.tsx` |
| A setting | just `PUT /api/settings/<key>`; read via `useSettings().raw` |
| A memory field | `models.Memory`, `schemas.MemoryOut`, `lib/types.ts`, and a migration for Postgres |

Schema changes: v0.1 relies on `create_all`, which only creates missing tables. The first change to an existing table must introduce Alembic (noted in ROADMAP).
