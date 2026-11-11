"""Memory lifecycle + retrieval.

Rules enforced here (see MEMORY_SCHEMA.md):
* Inferred memories never become `user_confirmed` without an explicit user action.
* Assistant-originated memories start as `proposed` and are excluded from context
  until the user accepts them.
* Corrections are recorded in `correction_history`; superseding keeps the old row.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .models import Memory, utcnow

LAYERS = (
    "core_identity",
    "life_context",
    "projects_goals",
    "short_term",
    "behavioural",
    "assistant_operating",
)

# How much each layer counts in retrieval. Core identity is always included separately.
LAYER_WEIGHT = {
    "core_identity": 1.0,
    "life_context": 0.9,
    "projects_goals": 0.9,
    "short_term": 0.8,
    "behavioural": 0.6,
    "assistant_operating": 0.3,
}

_STOP = set(
    """a an and are as at be but by for from has have i i'm im in is it its me my of on or
    so that the this to was we what when where which who why will with you your can could
    should would do does did how about just like get got help please tell know want need
    jarvis hey hi hello""".split()
)


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9äöüß']+", text.lower()) if len(t) > 2 and t not in _STOP}


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def is_expired(m: Memory, now: datetime | None = None) -> bool:
    now = now or utcnow()
    exp = _aware(m.expires_at)
    return exp is not None and exp <= now


def usable_query(user_id: str):
    return select(Memory).where(Memory.user_id == user_id, Memory.status == "active")


def retrieve_for_context(
    db: Session, user_id: str, query: str, limit_core: int = 25, limit_other: int = 15
) -> list[Memory]:
    """Pick memories to put in front of the model for this message.

    v0.1 uses keyword overlap. ARCHITECTURE.md describes the planned pgvector upgrade;
    the call signature stays the same.
    """
    now = utcnow()
    rows = [m for m in db.scalars(usable_query(user_id)).all() if not is_expired(m, now)]
    core = [m for m in rows if m.layer == "core_identity"]
    core.sort(key=lambda m: (m.verification != "user_confirmed", -m.relevance))
    core = core[:limit_core]

    q = _tokens(query)
    scored: list[tuple[float, Memory]] = []
    for m in rows:
        if m.layer == "core_identity":
            continue
        overlap = len(q & _tokens(m.content + " " + m.category + " " + " ".join(m.tags or [])))
        base = LAYER_WEIGHT.get(m.layer, 0.5) * (0.5 + m.relevance)
        # Life context is small and broadly useful; include it even without overlap.
        if overlap == 0 and m.layer != "life_context":
            continue
        score = overlap * base + (0.4 if m.layer == "life_context" else 0) + 0.2 * m.confidence
        scored.append((score, m))
    scored.sort(key=lambda x: -x[0])
    chosen = core + [m for _, m in scored[:limit_other]]
    for m in chosen:
        m.last_used_at = now
    db.commit()
    return chosen


def record_correction(m: Memory, field: str, old: Any, new: Any, note: str = "") -> None:
    hist = list(m.correction_history or [])
    hist.append(
        {
            "at": utcnow().isoformat(),
            "field": field,
            "old": old if not isinstance(old, datetime) else old.isoformat(),
            "new": new if not isinstance(new, datetime) else new.isoformat(),
            "note": note,
        }
    )
    m.correction_history = hist


def search(db: Session, user_id: str, q: str | None, layer: str | None, status: str | None):
    stmt = select(Memory).where(Memory.user_id == user_id)
    if layer:
        stmt = stmt.where(Memory.layer == layer)
    if status:
        stmt = stmt.where(Memory.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Memory.content.ilike(like), Memory.category.ilike(like)))
    return db.scalars(stmt.order_by(Memory.updated_at.desc())).all()
