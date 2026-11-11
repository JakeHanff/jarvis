"""Built-in local skills. External integrations (Google Calendar, Gmail, Graph) will
register their own skills with `requires_integration` set."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select

from ..models import CalendarEvent, Memory, Task
from .base import Skill, SkillContext, SkillError
from .registry import register


def _task_dict(t: Task) -> dict[str, Any]:
    return {"id": t.id, "title": t.title, "kind": t.kind, "status": t.status, "due_date": t.due_date}


def _create_task(ctx: SkillContext, data: dict[str, Any]) -> dict[str, Any]:
    due = data.get("due_date")
    if due:
        try:
            datetime.strptime(due, "%Y-%m-%d")
        except ValueError:
            raise SkillError("due_date must be YYYY-MM-DD") from None
    t = Task(
        user_id=ctx.user_id,
        title=data["title"].strip()[:500],
        notes=data.get("notes", ""),
        kind=data.get("kind", "daily"),
        priority=int(data.get("priority", 2)),
        due_date=due,
        estimate_minutes=data.get("estimate_minutes"),
        source=ctx.actor,
    )
    ctx.db.add(t)
    ctx.db.commit()
    return {"task": _task_dict(t)}


def _list_tasks(ctx: SkillContext, data: dict[str, Any]) -> dict[str, Any]:
    stmt = select(Task).where(Task.user_id == ctx.user_id, Task.status == data.get("status", "open"))
    if data.get("kind"):
        stmt = stmt.where(Task.kind == data["kind"])
    return {"tasks": [_task_dict(t) for t in ctx.db.scalars(stmt).all()]}


def _complete_task(ctx: SkillContext, data: dict[str, Any]) -> dict[str, Any]:
    from ..models import utcnow

    t = ctx.db.get(Task, data["task_id"])
    if not t or t.user_id != ctx.user_id:
        raise SkillError("Task not found")
    t.status = "done"
    t.completed_at = utcnow()
    ctx.db.commit()
    return {"task": _task_dict(t)}


def _search_memory(ctx: SkillContext, data: dict[str, Any]) -> dict[str, Any]:
    q = f"%{data['query']}%"
    rows = ctx.db.scalars(
        select(Memory).where(
            Memory.user_id == ctx.user_id, Memory.status == "active", Memory.content.ilike(q)
        )
    ).all()
    return {"memories": [{"id": m.id, "layer": m.layer, "content": m.content} for m in rows[:20]]}


def _create_event(ctx: SkillContext, data: dict[str, Any]) -> dict[str, Any]:
    try:
        start = datetime.fromisoformat(data["start"])
        end = datetime.fromisoformat(data["end"])
    except ValueError:
        raise SkillError("start/end must be ISO-8601 datetimes") from None
    if end <= start:
        raise SkillError("end must be after start")
    ev = CalendarEvent(
        user_id=ctx.user_id,
        title=data["title"],
        start=start,
        end=end,
        location=data.get("location", ""),
        notes=data.get("notes", ""),
    )
    ctx.db.add(ev)
    ctx.db.commit()
    return {"event": {"id": ev.id, "title": ev.title, "start": data["start"], "end": data["end"]}}


def register_builtin() -> None:
    register(
        Skill(
            name="tasks.create",
            description="Create a task (daily), long-term task, or goal.",
            input_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "notes": {"type": "string"},
                    "kind": {"type": "string", "enum": ["daily", "long_term", "goal"]},
                    "priority": {"type": "integer", "enum": [1, 2, 3]},
                    "due_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "estimate_minutes": {"type": "integer"},
                },
                "required": ["title"],
            },
            output_description="The created task.",
            risk="low",
            permissions=["tasks:write"],
            handler=_create_task,
            tags=["tasks"],
        )
    )
    register(
        Skill(
            name="tasks.list",
            description="List tasks by status and kind.",
            input_schema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["open", "done", "archived"]},
                    "kind": {"type": "string", "enum": ["daily", "long_term", "goal"]},
                },
                "required": [],
            },
            output_description="Matching tasks.",
            risk="low",
            permissions=["tasks:read"],
            handler=_list_tasks,
            tags=["tasks"],
        )
    )
    register(
        Skill(
            name="tasks.complete",
            description="Mark a task as done.",
            input_schema={
                "type": "object",
                "properties": {"task_id": {"type": "string"}},
                "required": ["task_id"],
            },
            output_description="The updated task.",
            risk="low",
            permissions=["tasks:write"],
            handler=_complete_task,
            tags=["tasks"],
        )
    )
    register(
        Skill(
            name="memory.search",
            description="Search active memories by text.",
            input_schema={
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
            output_description="Matching memories.",
            risk="low",
            permissions=["memory:read"],
            handler=_search_memory,
            tags=["memory"],
        )
    )
    register(
        Skill(
            name="calendar.create_event",
            description="Create an event in the local JARVIS calendar.",
            input_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "start": {"type": "string", "description": "ISO-8601"},
                    "end": {"type": "string", "description": "ISO-8601"},
                    "location": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["title", "start", "end"],
            },
            output_description="The created event.",
            # Changing someone's calendar is consequential -> needs approval by default.
            risk="medium",
            permissions=["calendar:write"],
            handler=_create_event,
            tags=["calendar"],
        )
    )
