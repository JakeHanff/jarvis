from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import memory_service
from ..db import get_db
from ..deps import require_access
from ..models import ActionLog, Memory, utcnow
from ..schemas import MemoryIn, MemoryOut, MemoryPatch, MemorySupersede

router = APIRouter(prefix="/api/memories", tags=["memories"])


def _get(db: Session, user: str, mid: str) -> Memory:
    m = db.get(Memory, mid)
    if not m or m.user_id != user:
        raise HTTPException(404, "Memory not found")
    return m


def _log(db: Session, user: str, skill: str, summary: str, data: dict) -> None:
    db.add(ActionLog(user_id=user, actor="user", skill=skill, status="executed", summary=summary, input=data))


@router.get("", response_model=list[MemoryOut])
def list_memories(
    q: str | None = None,
    layer: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: str = Depends(require_access),
):
    return memory_service.search(db, user, q, layer, status)


@router.post("", response_model=MemoryOut, status_code=201)
def create_memory(body: MemoryIn, db: Session = Depends(get_db), user: str = Depends(require_access)):
    data = body.model_dump()
    m = Memory(user_id=user, **data)
    # Something the user typed into the memory panel themselves is confirmed by definition.
    if body.kind == "stated" and body.source == "user" and body.status == "active":
        m.verification = "user_confirmed"
    db.add(m)
    db.commit()
    return m


@router.patch("/{mid}", response_model=MemoryOut)
def update_memory(mid: str, body: MemoryPatch, db: Session = Depends(get_db), user: str = Depends(require_access)):
    m = _get(db, user, mid)
    data = body.model_dump(exclude_unset=True)
    note = data.pop("note", "")
    changed = False
    for k, v in data.items():
        old = getattr(m, k)
        if old != v:
            memory_service.record_correction(m, k, old, v, note)
            setattr(m, k, v)
            changed = True
    if changed and ("content" in data or "layer" in data or "kind" in data):
        m.verification = "user_corrected"
    db.commit()
    return m


@router.post("/{mid}/confirm", response_model=MemoryOut)
def confirm_memory(mid: str, db: Session = Depends(get_db), user: str = Depends(require_access)):
    """Accept a proposed memory and/or mark it as confirmed by the user."""
    m = _get(db, user, mid)
    if m.status in ("proposed", "archived"):
        memory_service.record_correction(m, "status", m.status, "active", "confirmed by user")
        m.status = "active"
    m.verification = "user_confirmed"
    db.commit()
    return m


@router.post("/{mid}/reject", response_model=MemoryOut)
def reject_memory(mid: str, db: Session = Depends(get_db), user: str = Depends(require_access)):
    m = _get(db, user, mid)
    memory_service.record_correction(m, "status", m.status, "rejected", "rejected by user")
    m.status = "rejected"
    db.commit()
    return m


@router.post("/{mid}/supersede", response_model=MemoryOut)
def supersede_memory(
    mid: str, body: MemorySupersede, db: Session = Depends(get_db), user: str = Depends(require_access)
):
    """Replace a memory with an updated version while keeping the old one for history."""
    old = _get(db, user, mid)
    new = Memory(
        user_id=user,
        layer=old.layer,
        category=old.category,
        content=body.content,
        kind="stated",
        source="user:correction",
        confidence=1.0,
        verification="user_confirmed",
        status="active",
        relevance=old.relevance,
        is_temporary=old.is_temporary,
        tags=list(old.tags or []),
        related_ids=[old.id],
        supersedes_id=old.id,
        provenance={"superseded_from": old.id, "note": body.note},
    )
    db.add(new)
    db.flush()
    memory_service.record_correction(old, "status", old.status, "superseded", body.note)
    old.status = "superseded"
    old.superseded_by_id = new.id
    db.commit()
    return new


@router.delete("/{mid}", status_code=204)
def delete_memory(mid: str, db: Session = Depends(get_db), user: str = Depends(require_access)):
    """Hard delete. The audit log records that a deletion happened, not the content."""
    m = _get(db, user, mid)
    _log(db, user, "memory.delete", "Deleted a memory", {"id": m.id, "layer": m.layer, "at": utcnow().isoformat()})
    db.delete(m)
    db.commit()
