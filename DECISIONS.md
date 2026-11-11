# Decisions

Format: date · decision · why · trade-off / how to reverse.

### 2026-11-11 · Two-process app: Next.js frontend + FastAPI backend
Matches the agreed stack. Python is the better home for AI orchestration, memory processing and future scheduled jobs; Next.js for the UI. *Trade-off:* two runtimes to install. Mitigated by `npm run setup` / `npm run dev` wrappers.

### 2026-11-11 · Next.js proxies `/api/*` to the backend
Single origin for every device, no CORS, backend stays on localhost, phones need one URL. *Reverse:* call the hosted API directly and add CORS.

### 2026-11-11 · SQLAlchemy with SQLite by default, Postgres/Supabase via `DATABASE_URL`
Lets v0.1 run with zero accounts while keeping the cloud path a config change. Supabase is used as managed Postgres; its client SDK is not used in the browser (keeps all logic and secrets in the backend). *Trade-off:* no Supabase realtime yet; devices poll every 15–30 s.

### 2026-11-11 · Shared access token instead of accounts for v0.1
Single user, local/LAN only. Real auth (Supabase Auth) is required before public hosting. Every row already has `user_id`.

### 2026-11-11 · Default model: Anthropic `claude-opus-5-5`, effort `medium`, provider-agnostic interface
Strong reasoning for a "challenge me" assistant; effort configurable via `ANTHROPIC_EFFORT`. Server-side refusal fallback enabled (`ANTHROPIC_FALLBACKS=false` disables). OpenAI supported through the same interface, but requires `OPENAI_MODEL` to be set explicitly. Costs are per token on the user's own key.

### 2026-11-11 · Memory/task proposals via a tagged JSON block, not tool use
Provider-independent and one request per turn. Malformed blocks are dropped safely. Moving to native tool use (Phase 2) reuses the skill registry, whose input schemas are already tool-shaped.

### 2026-11-11 · Assistant and imported memories default to `proposed`
The user explicitly asked that uncertain inferences never be silently promoted and that historical imports be reviewable. Cost: some review effort. A "review queue" UI keeps it fast.

### 2026-11-11 · Keyword retrieval for v0.1
Good enough for tens to hundreds of memories, no extra services. Next: pgvector embeddings on Supabase behind the same function.

### 2026-11-11 · PWA first, Tauri later
A responsive PWA covers laptop, iPhone and iPad today with one codebase. Tauri (auto-start, tray, notifications, Windows context agent) is planned for Phase 5; the web app runs unchanged inside it. Requires the Rust toolchain, so deferred until needed.

### 2026-11-11 · Appearance and layouts stored server-side, applied as CSS variables
Customisation follows the user across devices and is data, not code. Separate `desktop` and `mobile` layout profiles; presets save both plus appearance.

### 2026-11-11 · `create_all` instead of migrations for now
Fastest start. **Must switch to Alembic before the first change to an existing table.**
