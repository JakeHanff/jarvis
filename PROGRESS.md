# Progress

## Current version: 0.1.0 (2026-11-11)

### v0.1 milestone checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Open the app on the Lenovo | ✅ `npm run dev` / `npm start` → http://localhost:3000 |
| 2 | Visually appealing dashboard | ✅ glass widgets over a wallpaper, dark + light themes |
| 3 | Add and complete tasks | ✅ daily tasks, long-term tasks, goals with progress |
| 4 | Change theme / wallpaper | ✅ theme, accent, 6 wallpaper presets, upload, URL, opacity, blur, density, presets |
| 5 | Chat with JARVIS | ✅ implemented, **requires configuration** (`ANTHROPIC_API_KEY`). Request path checked against the live API (it reached authentication); a full reply with a real key has **not** been tested here. |
| 6 | Store / retrieve persistent memories | ✅ |
| 7 | Review / correct stored information | ✅ Memory page: confirm, correct, update-with-history, temporary, archive, delete, "incorrect" feedback |
| 8 | Access from another device | 🟡 works over the same Wi-Fi with `npm run dev:lan` while the laptop runs (checked with an emulated iPhone browser in a separate session). Laptop-off access needs hosting (v0.2). |
| 9 | Restart without losing data | ✅ SQLite in `data/`; checked by reload in the browser test |

### Implemented
- **Backend (FastAPI):** tasks, memories (6 layers, provenance, confidence, verification, status lifecycle, supersede, correction history), conversations/messages, local calendar events, key/value settings, feedback, action log + approval queue, devices, image uploads, export, erase-all, memory import (profile/list/lines), ChatGPT `conversations.json` import, AI distillation of conversations into memory proposals, rule-based insights (overdue, due today, stale goals, review queue, stale memories, calendar overlaps, AI not configured), status endpoint, skill registry with 5 built-in skills.
- **AI:** provider abstraction; Anthropic (official SDK, prompt caching, server-side refusal fallback, effort setting); OpenAI (HTTP, needs `OPENAI_MODEL`). Context = memories (labelled), open tasks, next 7 days of events, local time. Memory/task proposals require approval. Autonomy pause drops proposals.
- **Frontend (Next.js 15, React 19, Tailwind 4):** widget registry; drag-to-reorder, resize, hide/show; separate desktop/mobile layouts; Customise drawer; Memory page; Settings page (AI/storage status, access token, devices, autonomy + approvals, integrations status, imports, action log, export, erase); full-screen chat; per-message feedback; PWA manifest + icons; device heartbeat.
- **Tooling:** `npm run setup | dev | dev:lan | start | test` (cross-platform Node scripts), `.env.example`, Supabase SQL migration with RLS enabled.

### Checks run (2026-11-11, Linux cloud container)
- Backend: `pytest` — 11 tests pass (tasks, memory lifecycle, import review default, honest 503 without AI, chat flow with a test-double provider including proposals/approval/do-not-remember, proposal parsing, access token, settings/events/conflict insight, ChatGPT import + dedupe, export/wipe).
- Frontend: `eslint`, `tsc --noEmit`, `next build` — pass.
- Browser (Playwright/Chromium): added tasks, completed one, added goal, memory and event, changed accent + wallpaper, reloaded → all persisted; no console errors; emulated iPhone saw the same data with no horizontal overflow.
- Production mode (`npm start`): built and served; wallpaper upload endpoint accepted a PNG, served it, rejected a non-image.

### Not yet verified
- Running on Windows itself (scripts are written for it — `py -3`, `.cmd` shims, `taskkill` — but were only run on Linux).
- A real chat reply with a valid API key.
- Postgres/Supabase mode (code path written, RLS statement included; not run against a real database).
- Wallpaper upload through the UI button (the upload endpoint itself was tested: PNG accepted and served, text file rejected).

### Known limitations
- Devices sync by polling (15–60 s), not realtime.
- Keyword memory retrieval; no embeddings yet.
- Chat waits for the full reply (no streaming).
- No Alembic migrations yet.
- Calendar is local only; Google/Microsoft integrations not started.
- Drag-and-drop reordering uses HTML5 drag events, which don't fire on iPhone/iPad touch; on touch devices use resize/hide (reorder via desktop for now).

## Next steps
See ROADMAP.md → "Next milestone: v0.2". The first decision needed from the user: where to host (and creating a Supabase project).

## Session log
- **2026-11-11** — Project created. Phase 0 + Phase 1 complete, Phase 2 core (providers, memory, proposals, imports) in place.
