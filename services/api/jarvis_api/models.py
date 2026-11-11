"""Database tables.

Portable across SQLite (local dev) and PostgreSQL (Supabase). JSON columns use the
generic SQLAlchemy JSON type; ids are UUID strings. Every user-owned row carries
`user_id` so Supabase row-level security can be applied later without reshaping data.
See MEMORY_SCHEMA.md for the meaning of memory fields.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Always timezone-aware UTC in Python, regardless of backend (SQLite drops tzinfo)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, onupdate=utcnow
    )


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(500))
    notes: Mapped[str] = mapped_column(Text, default="")
    # daily = immediate responsibilities; long_term = multi-week work; goal = objective
    kind: Mapped[str] = mapped_column(String(20), default="daily", index=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open|done|archived
    priority: Mapped[int] = mapped_column(Integer, default=2)  # 1 high, 2 normal, 3 low
    due_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    estimate_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0-100, mainly for goals
    parent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    sort_order: Mapped[float] = mapped_column(Float, default=0)
    source: Mapped[str] = mapped_column(String(40), default="user")  # user|assistant|import
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class Memory(TimestampMixin, Base):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    # core_identity | life_context | projects_goals | short_term | behavioural | assistant_operating
    layer: Mapped[str] = mapped_column(String(32), index=True)
    category: Mapped[str] = mapped_column(String(64), default="general")
    content: Mapped[str] = mapped_column(Text)
    # stated (user said it) | inferred (assistant concluded it) | observed (pattern from data)
    kind: Mapped[str] = mapped_column(String(16), default="stated")
    source: Mapped[str] = mapped_column(String(120), default="user")
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    # unverified | user_confirmed | user_corrected
    verification: Mapped[str] = mapped_column(String(20), default="unverified")
    # active | proposed (awaiting review) | superseded | rejected | archived
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    relevance: Mapped[float] = mapped_column(Float, default=0.5)
    is_temporary: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    review_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    related_ids: Mapped[list] = mapped_column(JSON, default=list)
    supersedes_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    superseded_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    correction_history: Mapped[list] = mapped_column(JSON, default=list)
    last_used_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(300), default="New conversation")
    source: Mapped[str] = mapped_column(String(40), default="jarvis")  # jarvis | import:chatgpt
    mode: Mapped[str] = mapped_column(String(20), default="auto")
    meta: Mapped[dict] = mapped_column(JSON, default=dict)

    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class CalendarEvent(TimestampMixin, Base):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(300))
    start: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    end: Mapped[datetime] = mapped_column(UTCDateTime())
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str] = mapped_column(String(300), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(40), default="local")  # local | google (future)
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)


class UserSetting(Base):
    """Key/value settings: appearance, layout:<profile>, layout_presets, autonomy, ..."""

    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, onupdate=utcnow
    )


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    target_type: Mapped[str] = mapped_column(String(32))  # message | memory | action | task
    target_id: Mapped[str] = mapped_column(String(36))
    # correct | incorrect | useful | not_useful | remember | do_not_remember | change_preference
    kind: Mapped[str] = mapped_column(String(32))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class ActionLog(Base):
    """Audit log AND approval queue. status=proposed rows await the user's decision."""

    __tablename__ = "action_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    actor: Mapped[str] = mapped_column(String(16))  # user | assistant | system
    skill: Mapped[str] = mapped_column(String(80))  # e.g. tasks.create
    risk: Mapped[str] = mapped_column(String(10), default="low")  # low | medium | high
    # proposed | approved | rejected | executed | failed
    status: Mapped[str] = mapped_column(String(16), index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    input: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str] = mapped_column(Text, default="")
    origin: Mapped[dict] = mapped_column(JSON, default=dict)  # e.g. {"message_id": ...}
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # client-generated stable id
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(120))
    platform: Mapped[str] = mapped_column(String(40))  # windows | ios | ipados | android | other
    capabilities: Mapped[list] = mapped_column(JSON, default=list)
    first_seen: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
