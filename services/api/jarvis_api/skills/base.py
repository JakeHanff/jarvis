"""Skill interface.

A skill is a named capability with a declared input schema, permissions and risk
level. Every execution goes through `run_skill`, which logs to ActionLog. Skills
whose risk is above the user's auto-approve threshold must be proposed and approved
first (see SECURITY.md -> Autonomy levels).

The JSON-schema `input_schema` is deliberately shaped like an LLM tool definition /
MCP tool, so the same registry can be exposed to the model in Phase 2 and to MCP
clients later without a rewrite.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from sqlalchemy.orm import Session

Risk = Literal["low", "medium", "high"]


@dataclass
class SkillContext:
    db: Session
    user_id: str
    actor: str  # user | assistant | system


@dataclass
class Skill:
    name: str  # e.g. "tasks.create"
    description: str
    input_schema: dict[str, Any]
    risk: Risk
    permissions: list[str]
    handler: Callable[[SkillContext, dict[str, Any]], dict[str, Any]]
    output_description: str = ""
    # Integration this skill depends on; None = built-in/local.
    requires_integration: str | None = None
    tags: list[str] = field(default_factory=list)

    def describe(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
            "output": self.output_description,
            "risk": self.risk,
            "permissions": self.permissions,
            "requires_integration": self.requires_integration,
            "tags": self.tags,
        }


class SkillError(Exception):
    pass
