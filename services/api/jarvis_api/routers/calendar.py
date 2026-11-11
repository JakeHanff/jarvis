from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_access
from ..models import CalendarEvent, utcnow
from ..schemas import EventIn, EventOut, EventPatch

router = APIRouter(prefix="/api/events", tags=["calendar"])


@router.get("", response_model=list[EventOut])
def list_events(
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    user: str = Depends(require_access),
):
    start = start or (utcnow() - timedelta(days=1))
    end = end or (utcnow() + timedelta(days=14))
    stmt = (
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user, CalendarEvent.end >= start, CalendarEvent.start <= end)
        .order_by(CalendarEvent.start)
    )
    return db.scalars(stmt).all()


@router.post("", response_model=EventOut, status_code=201)
def create_event(body: EventIn, db: Session = Depends(get_db), user: str = Depends(require_access)):
    if body.end <= body.start:
        raise HTTPException(422, "End must be after start")
    ev = CalendarEvent(user_id=user, **body.model_dump())
    db.add(ev)
    db.commit()
    return ev


@router.patch("/{eid}", response_model=EventOut)
def update_event(eid: str, body: EventPatch, db: Session = Depends(get_db), user: str = Depends(require_access)):
    ev = db.get(CalendarEvent, eid)
    if not ev or ev.user_id != user:
        raise HTTPException(404, "Event not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ev, k, v)
    if ev.end <= ev.start:
        raise HTTPException(422, "End must be after start")
    db.commit()
    return ev


@router.delete("/{eid}", status_code=204)
def delete_event(eid: str, db: Session = Depends(get_db), user: str = Depends(require_access)):
    ev = db.get(CalendarEvent, eid)
    if not ev or ev.user_id != user:
        raise HTTPException(404, "Event not found")
    db.delete(ev)
    db.commit()
