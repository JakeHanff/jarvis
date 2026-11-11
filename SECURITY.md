# Security, permissions and data ownership

## Current posture (v0.1)

| Area | Status |
|---|---|
| Secrets | Only in `.env` (git-ignored), read by the backend. Never sent to the browser, never in frontend code. |
| Network exposure | Backend binds to `127.0.0.1`. `npm run dev` binds the web server to localhost too. `npm run dev:lan` exposes the web server to the local network and warns if no access token is set. |
| Authentication | Optional shared bearer token (`JARVIS_ACCESS_TOKEN`), compared in constant time. Required before using LAN mode. Stored per device in the browser's localStorage. **Not** a substitute for real accounts on the public internet — see "Before hosting publicly". |
| Transport | Plain HTTP on localhost/LAN. Hosted deployments must be HTTPS. |
| Database | SQLite file in `data/` (git-ignored) or Postgres. On Postgres, row-level security is enabled on every table with no policies, so Supabase's public REST API exposes nothing. |
| Uploads | Images only (PNG/JPEG/WebP/GIF), size-capped, random file names, served with the same token check. |
| Model output | Can't execute anything. It can only *propose* memories and tasks, which wait for approval. |
| Untrusted content | Memories, imported transcripts and (future) emails/web pages are wrapped in tags and the system prompt says they are data, not instructions. |
| Audit | `action_log` records proposals, approvals, rejections, executions, failures and deletions. |
| Data control | Export all (`GET /api/export`), erase all (`DELETE /api/data?confirm=DELETE-EVERYTHING`), per-memory delete. |

## Autonomy levels

| Level | Meaning | Status |
|---|---|---|
| 1 | Observe and inform (Insights) | ✅ rule-based insights |
| 2 | Prepare actions for approval | ✅ current level — every assistant action is `proposed` |
| 3 | Perform pre-approved low-risk actions | ⏳ plumbing exists (`registry.run_direct`, `auto_approve_max_risk`), not enabled |
| 4 | Coordinate multi-step workflows | Planned (Phase 4) |
| 5 | Advanced proactive assistance | Planned (Phase 6) |

Skill risk levels: `low` (create/complete own task, search memory), `medium` (calendar changes), `high` (reserved: sending messages, deleting external data, unsubscribing, anything involving money). **High-risk skills always require explicit approval and can never be auto-approved by a setting.** Financial transactions are out of scope until explicitly designed with separate safeguards; market *monitoring* will be a read-only skill with no execution path.

The pause switch (Settings → Autonomy) makes JARVIS drop all proposals.

## Rules for future work

- Use official APIs and OAuth with least-privilege scopes (e.g. `calendar.events` not full account). Store refresh tokens encrypted at rest on the backend; support revocation in Settings.
- Treat email bodies, web pages, Teams content and documents as untrusted. Never let their text choose which tool runs or with what arguments without user confirmation.
- Device agents (Windows context) send only allow-listed, user-visible metadata; sensitive apps are excluded; there is a visible pause control and a retention limit.
- Generated or third-party skills are reviewed, tested and approved before getting any permission. No arbitrary code from GitHub runs in the backend.
- The assistant cannot modify its own security rules: the system prompt and approval requirements live in code, not in memory or settings that the model can propose changes to.

## Before hosting publicly

1. Replace the shared token with Supabase Auth (email magic link / passkey) and verify JWTs in `deps.require_access`.
2. Add RLS policies `user_id = auth.uid()::text` if any client ever talks to Supabase directly.
3. HTTPS only, secure cookies, rate limiting on `/api/chat`, request size limits at the proxy.
4. Move secrets to the host's secret store.
5. Review CORS (currently unnecessary because of the same-origin proxy).
