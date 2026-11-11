"""Shared FastAPI dependencies: auth + current user."""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from .config import get_settings


def require_access(authorization: str | None = Header(default=None)) -> str:
    """Return the current user id.

    v0.1 is single-user. If JARVIS_ACCESS_TOKEN is set, requests must carry it as a
    bearer token (constant-time comparison). Replace with Supabase JWT verification
    when multi-device cloud auth lands (see SECURITY.md).
    """
    s = get_settings()
    if s.jarvis_access_token:
        supplied = ""
        if authorization and authorization.lower().startswith("bearer "):
            supplied = authorization[7:].strip()
        if not hmac.compare_digest(supplied.encode(), s.jarvis_access_token.encode()):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing or invalid access token")
    return s.jarvis_user_id
