"""JARVIS API entrypoint: `uvicorn jarvis_api.main:app`."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import __version__
from .db import init_engine
from .routers import calendar, chat, memories, system, tasks
from .skills import registry
from .skills.builtin import register_builtin


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_engine()
    yield


def create_app() -> FastAPI:
    if not registry.all_skills():
        register_builtin()
    app = FastAPI(title="JARVIS API", version=__version__, lifespan=lifespan)
    for r in (tasks.router, memories.router, chat.router, calendar.router, system.router):
        app.include_router(r)

    @app.get("/api/health")
    def health():
        return {"ok": True, "version": __version__}

    return app


app = create_app()
