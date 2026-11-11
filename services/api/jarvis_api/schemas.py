from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

MemoryLayer = Literal[
    "core_identity",
    "life_context",
    "projects_goals",
    "short_term",
    "behavioural",
    "assistant_operating",
]
MemoryKind = Literal["stated", "inferred", "observed"]
MemoryStatus = Literal["active", "proposed", "superseded", "rejected", "archived"]
TaskKind = Literal["daily", "long_term", "goal"]
TaskStatus = Literal["open", "done", "archived"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- tasks
class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    notes: str = ""
    kind: TaskKind = "daily"
    priority: int = Field(default=2, ge=1, le=3)
    due_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    estimate_minutes: int | None = Field(default=None, ge=0)
    parent_id: str | None = None
    progress: int = Field(default=0, ge=0, le=100)


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    notes: str | None = None
    kind: TaskKind | None = None
    status: TaskStatus | None = None
    priority: int | None = Field(default=None, ge=1, le=3)
    due_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    estimate_minutes: int | None = Field(default=None, ge=0)
    actual_minutes: int | None = Field(default=None, ge=0)
    progress: int | None = Field(default=None, ge=0, le=100)
    sort_order: float | None = None
    clear_due_date: bool = False


class TaskOut(ORM):
    id: str
    title: str
    notes: str
    kind: str
    status: str
    priority: int
    due_date: str | None
    estimate_minutes: int | None
    actual_minutes: int | None
    progress: int
    parent_id: str | None
    sort_order: float
    source: str
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


# ---------------------------------------------------------------- memories
class MemoryIn(BaseModel):
    layer: MemoryLayer
    content: str = Field(min_length=1, max_length=5000)
    category: str = "general"
    kind: MemoryKind = "stated"
    source: str = "user"
    confidence: float = Field(default=1.0, ge=0, le=1)
    status: Literal["active", "proposed"] = "active"
    relevance: float = Field(default=0.5, ge=0, le=1)
    is_temporary: bool = False
    expires_at: datetime | None = None
    review_at: datetime | None = None
    tags: list[str] = []
    related_ids: list[str] = []
    provenance: dict[str, Any] = {}


class MemoryPatch(BaseModel):
    layer: MemoryLayer | None = None
    content: str | None = Field(default=None, min_length=1, max_length=5000)
    category: str | None = None
    kind: MemoryKind | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    relevance: float | None = Field(default=None, ge=0, le=1)
    is_temporary: bool | None = None
    expires_at: datetime | None = None
    review_at: datetime | None = None
    tags: list[str] | None = None
    related_ids: list[str] | None = None
    status: Literal["active", "archived"] | None = None
    note: str = ""  # why the user changed it; stored in correction_history


class MemorySupersede(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    note: str = ""


class MemoryOut(ORM):
    id: str
    layer: str
    category: str
    content: str
    kind: str
    source: str
    provenance: dict
    confidence: float
    verification: str
    status: str
    relevance: float
    is_temporary: bool
    expires_at: datetime | None
    review_at: datetime | None
    tags: list
    related_ids: list
    supersedes_id: str | None
    superseded_by_id: str | None
    correction_history: list
    created_at: datetime
    updated_at: datetime
    last_used_at: datetime | None


# ---------------------------------------------------------------- chat
class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=20000)
    conversation_id: str | None = None
    mode: Literal["auto", "casual", "academic", "strategic", "executive", "research"] = "auto"
    timezone: str | None = Field(default=None, max_length=64)  # IANA, e.g. Europe/Berlin


class MessageOut(ORM):
    id: str
    conversation_id: str
    role: str
    content: str
    meta: dict
    created_at: datetime


class ConversationOut(ORM):
    id: str
    title: str
    source: str
    mode: str
    created_at: datetime
    updated_at: datetime


class ChatOut(BaseModel):
    conversation: ConversationOut
    user_message: MessageOut
    assistant_message: MessageOut
    proposed_memories: list[MemoryOut] = []
    proposed_actions: list[ActionOut] = []


# ---------------------------------------------------------------- calendar
class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    start: datetime
    end: datetime
    all_day: bool = False
    location: str = ""
    notes: str = ""


class EventPatch(BaseModel):
    title: str | None = None
    start: datetime | None = None
    end: datetime | None = None
    all_day: bool | None = None
    location: str | None = None
    notes: str | None = None


class EventOut(ORM):
    id: str
    title: str
    start: datetime
    end: datetime
    all_day: bool
    location: str
    notes: str
    source: str


# ---------------------------------------------------------------- actions / feedback
class ActionOut(ORM):
    id: str
    actor: str
    skill: str
    risk: str
    status: str
    summary: str
    input: dict
    result: dict
    error: str
    origin: dict
    created_at: datetime
    decided_at: datetime | None


class FeedbackIn(BaseModel):
    target_type: Literal["message", "memory", "action", "task"]
    target_id: str
    kind: Literal[
        "correct",
        "incorrect",
        "useful",
        "not_useful",
        "remember",
        "do_not_remember",
        "change_preference",
    ]
    note: str = ""
    # for "remember": which layer to file the memory under (user can reclassify later)
    layer: MemoryLayer | None = None


class DeviceIn(BaseModel):
    id: str = Field(min_length=8, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    platform: str = "other"
    capabilities: list[str] = []


class DeviceOut(ORM):
    id: str
    name: str
    platform: str
    capabilities: list
    first_seen: datetime
    last_seen: datetime


ChatOut.model_rebuild()
