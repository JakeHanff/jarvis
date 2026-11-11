from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_access
from ..models import ActionLog, Task, utcnow
from ..schemas import TaskIn, TaskOut, TaskPatch

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get(db: Session, user: str, task_id: str) -> Task:
    t = db.get(Task, task_id)
    if not t or t.user_id != user:
        raise HTTPException(404, "Task not found")
    return t


def _log(db: Session, user: str, skill: str, summary: str, data: dict) -> None:
    db.add(ActionLog(user_id=user, actor="user", skill=skill, status="executed", summary=summary, input=data))


@router.get("", response_model=list[TaskOut])
def list_tasks(
    kind: str | None = None,
    status: str | None = None,
    include_done_today: bool = True,
    db: Session = Depends(get_db),
    user: str = Depends(require_access),
):
    stmt = select(Task).where(Task.user_id == user)
    if kind:
        stmt = stmt.where(Task.kind == kind)
    if status:
        stmt = stmt.where(Task.status == status)
    else:
        stmt = stmt.where(Task.status != "archived")
    rows = db.scalars(stmt.order_by(Task.status, Task.sort_order, Task.created_at)).all()
    return rows


@router.post("", response_model=TaskOut, status_code=201)
def create_task(body: TaskIn, db: Session = Depends(get_db), user: str = Depends(require_access)):
    max_order = db.scalar(select(func.max(Task.sort_order)).where(Task.user_id == user)) or 0
    t = Task(user_id=user, sort_order=max_order + 1, **body.model_dump())
    db.add(t)
    db.commit()
    return t


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, body: TaskPatch, db: Session = Depends(get_db), user: str = Depends(require_access)):
    t = _get(db, user, task_id)
    data = body.model_dump(exclude_unset=True)
    if data.pop("clear_due_date", False):
        t.due_date = None
    for k, v in data.items():
        setattr(t, k, v)
    if "status" in data:
        t.completed_at = utcnow() if data["status"] == "done" else None
        if data["status"] == "done" and t.kind == "goal":
            t.progress = 100
    db.commit()
    return t


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db), user: str = Depends(require_access)):
    t = _get(db, user, task_id)
    _log(db, user, "tasks.delete", f"Deleted task: {t.title}", {"id": t.id, "title": t.title, "kind": t.kind})
    db.delete(t)
    db.commit()
