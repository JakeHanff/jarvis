# Roadmap

Phases are guides, not walls. ✅ done · 🟡 partial · ⏳ next · ○ later

## Phase 0 — Foundation ✅
Repo structure, architecture, setup scripts, env template, schema (SQLite + Supabase SQL), auth approach, design system, docs.

## Phase 1 — Working dashboard ✅ (v0.1)
Responsive dashboard, widget registry, drag/resize/hide layout per device class, themes/accents/wallpapers/presets, daily tasks, goals & long-term tasks, local calendar, chat UI, memory review UI, insights, persistent storage, PWA manifest.

## Phase 2 — Intelligence & memory 🟡
- ✅ Provider abstraction (Anthropic, OpenAI), persistent conversations, layered memory, retrieval, corrections/supersede/history, proposals with approval, feedback, imports (profile + ChatGPT) with AI distillation.
- ⏳ **Streaming replies** in chat.
- ⏳ **Native tool use**: expose the skill registry to the model (create/complete tasks, search memory, propose events) with the approval gate.
- ⏳ **Semantic retrieval** with pgvector (Supabase) — replace keyword scoring.
- ⏳ Alembic migrations.
- ○ Periodic memory consolidation (merge duplicates, surface contradictions, expire short-term).

## Phase 3 — Productivity integrations ○
Google Calendar (OAuth, read first, then approved writes) → Gmail (read, categorise, draft, unsubscribe proposals) → Microsoft Graph for Teams assignments (depends on what the school tenant permits; fallbacks: forwarding emails, manual paste, browser extension) → task/deadline extraction → scheduling suggestions.

## Phase 4 — Proactive automation ○
Hosted backend + background jobs (scheduler independent of any browser), monitoring rules, push notifications (web push on iOS needs the PWA installed to the home screen), approval workflows, automation history, autonomy level 3 for whitelisted low-risk skills.

## Phase 5 — Desktop & devices ○
Tauri wrapper for Windows (auto-start, full-screen kiosk mode, tray, notifications), device registration with capabilities, Windows active-window agent with exclusions and pause, browser extension for page context.

## Phase 6 — Advanced personal intelligence ○
Behavioural pattern analysis (e.g. estimate vs actual time), planning, voice (speech-to-text, TTS, interruptible), expanded skills incl. read-only market monitoring, controlled skill generation with review.

---

## Next milestone: **v0.2 — "Always on, actually smart"**

1. **Host it** so it works with the laptop off: Supabase Postgres + backend on a small always-on host (e.g. Fly.io/Render/Railway) + frontend on Vercel or the same host; HTTPS; Supabase Auth replaces the shared token. *Needs your decision on host and a Supabase project.*
2. **Streaming chat** + **native tool use** through the skill registry (create tasks, search memory, propose events — with approvals).
3. **pgvector semantic memory** and a periodic consolidation job.
4. **Seed import**: load your ChatGPT memory profile and history, distill, review.
5. **Google Calendar read-only** sync into the calendar widget and chat context.
