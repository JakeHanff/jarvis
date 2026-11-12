from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import orchestrator
from ..ai.providers import ProviderError, get_provider, provider_status
from ..db import get_db
from ..deps import require_access
from ..models import Conversation, Message
from ..schemas import ChatIn, ChatOut, ConversationOut, MessageOut

router = APIRouter(prefix="/api", tags=["chat"])


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(source: str | None = None, db: Session = Depends(get_db), user: str = Depends(require_access)):
    stmt = select(Conversation).where(Conversation.user_id == user)
    if source:
        stmt = stmt.where(Conversation.source == source)
    return db.scalars(stmt.order_by(Conversation.updated_at.desc()).limit(200)).all()


@router.get("/conversations/{cid}/messages", response_model=list[MessageOut])
def conversation_messages(cid: str, db: Session = Depends(get_db), user: str = Depends(require_access)):
    c = db.get(Conversation, cid)
    if not c or c.user_id != user:
        raise HTTPException(404, "Conversation not found")
    return db.scalars(select(Message).where(Message.conversation_id == cid).order_by(Message.created_at)).all()


@router.delete("/conversations/{cid}", status_code=204)
def delete_conversation(cid: str, db: Session = Depends(get_db), user: str = Depends(require_access)):
    c = db.get(Conversation, cid)
    if not c or c.user_id != user:
        raise HTTPException(404, "Conversation not found")
    db.delete(c)
    db.commit()


@router.post("/chat", response_model=ChatOut)
async def chat(body: ChatIn, db: Session = Depends(get_db), user: str = Depends(require_access)):
    provider = get_provider()
    if provider is None:
        st = provider_status()
        raise HTTPException(
            503,
            {
                "code": "ai_not_configured",
                "message": "No AI model is configured. Set one up in the .env file (free option: Ollama with "
                "OLLAMA_MODEL, or ANTHROPIC_API_KEY for Claude) and restart JARVIS. Nothing was sent.",
                "status": st,
            },
        )
    if body.conversation_id:
        conv = db.get(Conversation, body.conversation_id)
        if not conv or conv.user_id != user:
            raise HTTPException(404, "Conversation not found")
    else:
        conv = Conversation(user_id=user, mode=body.mode)
        db.add(conv)
        db.commit()
    try:
        user_msg, asst, mems, acts = await orchestrator.run_turn(
            db, provider, user, conv, body.message, body.mode, body.timezone
        )
    except ProviderError as e:
        raise HTTPException(502 if not e.retryable else 503, {"code": "provider_error", "message": str(e)}) from None
    return ChatOut(
        conversation=conv,
        user_message=user_msg,
        assistant_message=asst,
        proposed_memories=mems,
        proposed_actions=acts,
    )
