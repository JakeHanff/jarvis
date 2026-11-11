from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..models import ActionLog, utcnow
from .base import Skill, SkillContext, SkillError

_REGISTRY: dict[str, Skill] = {}

RISK_ORDER = {"low": 0, "medium": 1, "high": 2}


def register(skill: Skill) -> Skill:
    if skill.name in _REGISTRY:
        raise ValueError(f"Skill already registered: {skill.name}")
    _REGISTRY[skill.name] = skill
    return skill


def get(name: str) -> Skill:
    try:
        return _REGISTRY[name]
    except KeyError:
        raise SkillError(f"Unknown skill: {name}") from None


def all_skills() -> list[Skill]:
    return list(_REGISTRY.values())


def _validate(skill: Skill, data: dict[str, Any]) -> None:
    """Minimal JSON-schema check: required keys + no unknown keys + basic types."""
    schema = skill.input_schema
    props = schema.get("properties", {})
    for key in schema.get("required", []):
        if key not in data:
            raise SkillError(f"Missing required input '{key}' for {skill.name}")
    for key, value in data.items():
        if key not in props:
            raise SkillError(f"Unexpected input '{key}' for {skill.name}")
        t = props[key].get("type")
        ok = {
            "string": isinstance(value, str),
            "integer": isinstance(value, int) and not isinstance(value, bool),
            "number": isinstance(value, (int, float)) and not isinstance(value, bool),
            "boolean": isinstance(value, bool),
            "array": isinstance(value, list),
            "object": isinstance(value, dict),
        }.get(t, True)
        if value is not None and not ok:
            raise SkillError(f"Input '{key}' for {skill.name} must be {t}")
        if "enum" in props[key] and value not in props[key]["enum"]:
            raise SkillError(f"Input '{key}' for {skill.name} must be one of {props[key]['enum']}")


def propose(
    db: Session, user_id: str, actor: str, name: str, data: dict[str, Any], summary: str, origin=None
) -> ActionLog:
    skill = get(name)
    _validate(skill, data)
    row = ActionLog(
        user_id=user_id,
        actor=actor,
        skill=name,
        risk=skill.risk,
        status="proposed",
        summary=summary,
        input=data,
        origin=origin or {},
    )
    db.add(row)
    db.commit()
    return row


def execute(db: Session, row: ActionLog) -> ActionLog:
    """Run an approved/direct action and record the outcome on its log row."""
    skill = get(row.skill)
    try:
        _validate(skill, row.input)
        result = skill.handler(SkillContext(db=db, user_id=row.user_id, actor=row.actor), row.input)
        row.status = "executed"
        row.result = result
    except SkillError as e:
        row.status = "failed"
        row.error = str(e)
    except Exception as e:  # noqa: BLE001 - recorded for the user, never swallowed silently
        row.status = "failed"
        row.error = f"{type(e).__name__}: {e}"
    row.decided_at = row.decided_at or utcnow()
    db.commit()
    return row


def run_direct(
    db: Session, user_id: str, actor: str, name: str, data: dict[str, Any], auto_approve_max: str
) -> ActionLog:
    """Execute immediately if risk <= auto_approve_max, otherwise leave as proposed."""
    skill = get(name)
    row = propose(db, user_id, actor, name, data, summary=f"{actor} ran {name}")
    if actor == "user" or RISK_ORDER[skill.risk] <= RISK_ORDER[auto_approve_max]:
        row.status = "approved"
        row.decided_at = utcnow()
        return execute(db, row)
    return row
