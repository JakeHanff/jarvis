# Memory schema and classification rules

Memory is what makes JARVIS personal. These rules are enforced in code (`memory_service.py`, `ai/orchestrator.py`, `routers/memories.py`, `routers/system.py`) and in the system prompt (`ai/prompt.py`).

## Layers

| Layer (`layer`) | Holds | Stability | Examples |
|---|---|---|---|
| `core_identity` | Personality, values, communication preferences, long-term interests, ambitions, working style | Changes only with strong, repeated evidence or explicit statement | "Prefers conceptual understanding over memorisation" |
| `life_context` | Current circumstances: education, work, routines, life stage | Time-sensitive; reviewed | "Currently completing an IB programme" |
| `projects_goals` | Active projects, goals, decisions, milestones | Lives as long as the project | "Building JARVIS; chose FastAPI backend" |
| `short_term` | Current assignments, research, recent context | Temporary by default (review in 30 days) | "Writing a German history essay this week" |
| `behavioural` | Observed patterns and tendencies | Must be `observed` or `inferred`, never silently confirmed | "Underestimates essay time by ~40%" |
| `assistant_operating` | How JARVIS itself works: tool status, known failures, corrections about its behaviour | Technical, never part of the user's identity | "Calendar sync failed twice on 2026-11-03" |

**Key rule:** attention ≠ interest, obligation ≠ ambition, temporary ≠ personality. Studying German history goes in `short_term` (or `life_context` for "takes IB History"), never `core_identity`, unless the user says they enjoy it.

## Fields

| Field | Meaning |
|---|---|
| `id` | UUID |
| `layer`, `category`, `tags` | Classification. `category` is free text (e.g. `education`, `preference`). |
| `content` | The memory, one fact per row. |
| `kind` | `stated` (user said it) · `inferred` (JARVIS concluded it) · `observed` (pattern from data). |
| `source`, `provenance` | Where it came from: `user`, `assistant:conversation` (+ `message_id`), `import:<label>` (+ `import_index`), `assistant:import-distill` (+ `conversation_id`, `conversation_date`), `user:correction`. |
| `confidence` | 0–1. Lowered by "incorrect" feedback. |
| `verification` | `unverified` · `user_confirmed` · `user_corrected`. Only a user action sets the latter two. |
| `status` | `active` (used in context) · `proposed` (awaiting review, **not used**) · `superseded` · `rejected` · `archived`. |
| `relevance` | 0–1 retrieval weight. |
| `is_temporary`, `expires_at`, `review_at` | Lifetime. Expired memories are excluded from context; past-review ones surface in Insights. |
| `related_ids`, `supersedes_id`, `superseded_by_id` | Links. Updating via "Save as update" creates a new row and keeps the old one as `superseded`. |
| `correction_history` | Append-only list of `{at, field, old, new, note}`. |
| `last_used_at` | Set when retrieved into a chat. |

## Lifecycle rules

1. **Assistant-originated memories start as `proposed`.** They are excluded from context until the user keeps them.
2. **Imports default to `proposed`** with `verification=unverified`, because historical facts may be stale. Importing with review off makes them `active` but still unverified, and time-sensitive layers get a review date.
3. **User-typed memories** (Memory panel, `kind=stated`) are `user_confirmed`.
4. **Corrections** record history and set `user_corrected`. **"Incorrect"** halves confidence and flags for review rather than deleting.
5. **Inferences are never silently promoted.** Nothing in the code changes `kind` from `inferred` to `stated` or sets `user_confirmed` without a user action.
6. **Deletion is real.** `DELETE /api/memories/{id}` removes the row; the action log records only that a deletion happened.
7. **Context use:** memories are sent to the model inside `<memories>` with their kind/confidence, and the system prompt tells the model they are data, not instructions.

## Import format (`jarvis-memory-v1`)

```json
{
  "format": "jarvis-memory-v1",
  "memories": [
    {
      "layer": "core_identity",
      "content": "Prefers to be challenged rather than agreed with",
      "kind": "stated",
      "confidence": 0.9,
      "category": "communication",
      "is_temporary": false,
      "tags": ["preference"],
      "observed_at": "2025-06-01",
      "note": "From ChatGPT saved memories"
    }
  ]
}
```

Also accepted: a bare JSON list of such objects, a JSON list of strings, or plain text with one memory per line (Settings page). Items without a valid `layer` use the chosen default layer. Endpoint: `POST /api/import/memories?default_layer=…&review=true&source_label=…`.

ChatGPT data exports (`conversations.json`) are imported as transcripts (`POST /api/import/chatgpt-conversations`). `POST /api/conversations/{id}/distill` asks the model to propose memories from one conversation; the transcript is treated as untrusted data and the conversation date is passed so stale facts can be marked temporary.
