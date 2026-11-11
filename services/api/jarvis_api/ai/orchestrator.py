"""One chat turn: gather context -> call provider -> store reply -> file proposals."""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import memory_service
from ..models import CalendarEvent, Conversation, Memory, Message, Task, UserSetting, utcnow
from ..skills import registry
from .prompt import STABLE_SYSTEM, build_dynamic_system, extract_proposals
from .providers import ChatProvider, ChatTurn

HISTORY_TURNS = 30
VALID_LAYERS = set(memory_service.LAYERS) - {"assistant_operating"}


def _local_now(tz: str | None) -> datetime:
    try:
        return datetime.now(ZoneInfo(tz)) if tz else datetime.now().astimezone()
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.now().astimezone()


def _file_memory_proposals(db: Session, user_id: str, items: list[dict], message_id: str) -> list[Memory]:
    out = []
    for p in items:
        content = str(p.get("content", "")).strip()
        layer = p.get("layer")
        if not content or layer not in VALID_LAYERS:
            continue
        kind = p.get("kind") if p.get("kind") in ("stated", "inferred", "observed") else "inferred"
        try:
            conf = max(0.0, min(1.0, float(p.get("confidence", 0.6))))
        except (TypeError, ValueError):
            conf = 0.6
        temporary = bool(p.get("is_temporary", layer == "short_term"))
        m = Memory(
            user_id=user_id,
            layer=layer,
            category=str(p.get("category", "general"))[:64],
            content=content[:5000],
            kind=kind,
            source="assistant:conversation",
            provenance={"message_id": message_id},
            confidence=conf,
            status="proposed",  # never active until the user accepts it
            is_temporary=temporary,
            review_at=utcnow() + timedelta(days=30) if temporary else None,
        )
        db.add(m)
        out.append(m)
    db.commit()
    return out


def _file_task_proposals(db: Session, user_id: str, items: list[dict], message_id: str):
    out = []
    for p in items:
        data = {k: p[k] for k in ("title", "kind", "due_date", "notes", "priority", "estimate_minutes") if k in p and p[k] is not None}
        if not isinstance(data.get("title"), str) or not data["title"].strip():
            continue
        if data.get("kind") not in (None, "daily", "long_term", "goal"):
            data.pop("kind")
        try:
            out.append(
                registry.propose(
                    db, user_id, "assistant", "tasks.create", data,
                    summary=f"Add task: {data['title']}", origin={"message_id": message_id},
                )
            )
        except registry.SkillError:
            continue
    return out


async def run_turn(
    db: Session,
    provider: ChatProvider,
    user_id: str,
    conversation: Conversation,
    user_text: str,
    mode: str,
    tz: str | None,
):
    now_local = _local_now(tz)
    memories = memory_service.retrieve_for_context(db, user_id, user_text)
    tasks = db.scalars(
        select(Task).where(Task.user_id == user_id, Task.status == "open").order_by(Task.due_date.is_(None), Task.due_date)
    ).all()
    now = utcnow()
    events = db.scalars(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user_id, CalendarEvent.end >= now, CalendarEvent.start <= now + timedelta(days=7))
        .order_by(CalendarEvent.start)
    ).all()

    history = db.scalars(
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.desc()).limit(HISTORY_TURNS)
    ).all()[::-1]

    user_msg = Message(conversation_id=conversation.id, role="user", content=user_text, meta={"mode": mode})
    db.add(user_msg)
    db.commit()

    turns = [ChatTurn(m.role, m.content) for m in history if m.role in ("user", "assistant") and m.content]
    turns.append(ChatTurn("user", user_text))
    # The API requires the first turn to be from the user.
    while turns and turns[0].role != "user":
        turns.pop(0)

    dynamic = build_dynamic_system(now_local, memories, tasks, events, mode)
    result = await provider.complete(STABLE_SYSTEM, dynamic, turns)
    text, proposals = extract_proposals(result.text)
    if not text.strip():
        text = "_(No text in the reply.)_" + (" " + " ".join(result.notes) if result.notes else "")

    asst = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=text,
        meta={
            "provider": result.provider,
            "model": result.model,
            "stop_reason": result.stop_reason,
            "usage": result.usage,
            "notes": result.notes,
            "memory_ids_used": [m.id for m in memories],
        },
    )
    db.add(asst)
    if conversation.title == "New conversation":
        conversation.title = user_text.strip().splitlines()[0][:80]
    conversation.updated_at = utcnow()
    db.commit()

    autonomy = db.get(UserSetting, (user_id, "autonomy"))
    if autonomy and (autonomy.value or {}).get("paused"):
        # Paused: the user has asked JARVIS not to suggest anything. Drop proposals.
        proposals = {"memories": [], "tasks": []}
    mems = _file_memory_proposals(db, user_id, proposals["memories"], asst.id)
    acts = _file_task_proposals(db, user_id, proposals["tasks"], asst.id)
    if mems or acts:
        asst.meta = {**asst.meta, "proposed_memory_ids": [m.id for m in mems], "proposed_action_ids": [a.id for a in acts]}
        db.commit()
    return user_msg, asst, mems, acts
