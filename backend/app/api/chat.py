import json
from datetime import datetime
import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.api.wallet import get_current_user_id
from app.core.config import settings
from app.db.session import get_session
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.models.wallet_transaction import WalletTransaction
from app.services.ai_service import (
    estimate_cost_toman,
    estimate_input_tokens_from_messages,
    get_model_pricing,
    get_usd_to_toman_rate,
    stream_chat_completion,
)
from app.services.memory_agent import (
    run_long_term_memory_task,
    run_short_term_memory_task,
)

router = APIRouter()


class ConversationResponse(BaseModel):
    id: int
    title: str | None
    selected_model: str
    created_at: datetime
    updated_at: datetime


class AttachmentBody(BaseModel):
    name: str
    mime_type: str
    data_url: str | None = None
    text_content: str | None = None


class StreamChatBody(BaseModel):
    text: str
    conversation_id: int | None = None
    model: str | None = None
    attachments: list[AttachmentBody] = Field(default_factory=list)


def _build_user_content(text: str, attachments: list[AttachmentBody]) -> list[dict]:
    parts: list[dict] = [{"type": "text", "text": text}]
    for att in attachments:
        if att.mime_type.startswith("image/") and att.data_url:
            parts.append({"type": "image_url", "image_url": {"url": att.data_url}})
        elif att.text_content:
            parts.append(
                {
                    "type": "text",
                    "text": f"[Attachment: {att.name}]\n{att.text_content[:12000]}",
                }
            )
        elif att.data_url:
            parts.append(
                {
                    "type": "text",
                    "text": f"[Attachment: {att.name}] Binary file attached (base64 omitted).",
                }
            )
    return parts


@router.get("/conversations")
def get_conversations(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Get all conversations for the current user that have at least one assistant response."""
    uid = int(user_id)
    conversations = session.exec(
        select(Conversation)
        .where(Conversation.user_id == uid)
        .order_by(Conversation.updated_at.desc())
    ).all()
    
    result = []
    for c in conversations:
        messages = session.exec(
            select(Message)
            .where(Message.conversation_id == c.id)
        ).all()
        
        # Only include conversations that have both user and assistant messages
        has_user = any(m.role == "user" for m in messages)
        has_assistant = any(m.role == "assistant" for m in messages)
        
        if has_user and has_assistant:
            result.append(
                ConversationResponse(
                    id=c.id,
                    title=c.title or "بدون عنوان",
                    selected_model=c.selected_model,
                    created_at=c.created_at,
                    updated_at=c.updated_at,
                )
            )
    
    return result


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: int,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Get all messages for a specific conversation."""
    uid = int(user_id)
    conversation = session.get(Conversation, conversation_id)
    if not conversation or conversation.user_id != uid:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.id)
    ).all()
    
    # Check if conversation has both user and assistant messages
    has_user = any(m.role == "user" for m in messages)
    has_assistant = any(m.role == "assistant" for m in messages)
    
    if not (has_user and has_assistant):
        raise HTTPException(status_code=404, detail="Conversation is incomplete")
    
    return {
        "conversation": ConversationResponse(
            id=conversation.id,
            title=conversation.title or "بدون عنوان",
            selected_model=conversation.selected_model,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        ),
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
            }
            for m in messages
        ],
    }


@router.post("/stream-demo")
async def stream_demo(
    body: StreamChatBody,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """Stream OpenRouter responses and persist conversations/messages."""
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message text is required")

    uid = int(user_id)
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    conversation: Conversation | None = None
    if body.conversation_id is not None:
        conversation = session.get(Conversation, body.conversation_id)
        if not conversation or conversation.user_id != uid:
            raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation is None:
        selected_model = body.model or settings.openrouter_default_model
        conversation = Conversation(
            user_id=uid,
            title=text[:60],
            selected_model=selected_model,
        )
        session.add(conversation)
        session.commit()
        session.refresh(conversation)
    else:
        if body.model and body.model != conversation.selected_model:
            raise HTTPException(
                status_code=400,
                detail="Model is locked for this conversation and cannot be changed",
            )
        selected_model = conversation.selected_model or settings.openrouter_default_model

    user_content_parts = _build_user_content(text, body.attachments)
    user_content_for_db = text
    if body.attachments:
        names = ", ".join(a.name for a in body.attachments)
        user_content_for_db = f"{text}\n\n[attachments: {names}]"

    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=user_content_for_db,
        token_cost=0.0,
    )
    session.add(user_msg)
    conversation.updated_at = datetime.utcnow()
    session.add(conversation)
    session.commit()

    history = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.id)
    ).all()
    
    # Get exchange rate and pricing in parallel (fast operations with cache)
    # Use cached exchange rate and pricing instead of synchronous calls
    usd_to_toman, pricing = await asyncio.gather(
        get_usd_to_toman_rate(),
        get_model_pricing(selected_model),
        return_exceptions=True,
    )
    
    # Handle potential errors
    if isinstance(usd_to_toman, Exception):
        usd_to_toman = float(settings.openrouter_usd_to_toman)
    if isinstance(pricing, Exception):
        pricing = await get_model_pricing(selected_model)
    
    # Use existing summary (don't re-compute it on every request)
    summary = conversation.memory_summary or ""

    recent_history = history[-settings.short_term_max_messages :]
    openrouter_messages: list[dict] = []
    if user.long_term_memory.strip():
        openrouter_messages.append(
            {
                "role": "system",
                "content": f"Long-term user memory:\n{user.long_term_memory.strip()}",
            }
        )
    if summary.strip():
        openrouter_messages.append(
            {
                "role": "system",
                "content": f"Short-term summary of earlier conversation:\n{summary.strip()}",
            }
        )
    for msg in recent_history[:-1]:
        openrouter_messages.append({"role": msg.role, "content": msg.content})
    openrouter_messages.append({"role": "user", "content": user_content_parts})

    estimated_input_tokens = estimate_input_tokens_from_messages(openrouter_messages)
    estimated_output_tokens = settings.openrouter_default_max_output_tokens
    estimated_cost_toman = estimate_cost_toman(
        pricing=pricing,
        input_tokens=estimated_input_tokens,
        output_tokens=estimated_output_tokens,
        usd_to_toman=usd_to_toman,
    )
    if user.wallet_balance < estimated_cost_toman:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Insufficient wallet balance. Required ~{int(estimated_cost_toman):,} toman, "
                f"current balance {int(user.wallet_balance):,} toman."
            ),
        )

    async def event_generator():
        meta = f'data: {{"conversation_id": {conversation.id}, "model": {json.dumps(selected_model)} }}\n\n'
        yield meta.encode("utf-8")
        assistant_chunks: list[str] = []
        usage_info: dict | None = None
        try:
            async for item in stream_chat_completion(
                model=selected_model,
                messages=openrouter_messages,
            ):
                if item.get("type") == "usage":
                    usage_info = item.get("usage")
                    continue
                chunk = item.get("text")
                if isinstance(chunk, str) and chunk:
                    assistant_chunks.append(chunk)
                    payload = json.dumps({"chunk": chunk}, ensure_ascii=False)
                    yield f"data: {payload}\n\n".encode("utf-8")
        except Exception as exc:
            err_payload = json.dumps({"error": str(exc)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n".encode("utf-8")
            yield b"data: [DONE]\n\n"
            return

        assistant_text = "".join(assistant_chunks).strip() or "(empty response)"
        assistant_msg = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=assistant_text,
            token_cost=0.0,
        )
        prompt_tokens = int((usage_info or {}).get("prompt_tokens") or estimated_input_tokens)
        completion_tokens = int(
            (usage_info or {}).get("completion_tokens")
            or (usage_info or {}).get("output_tokens")
            or max(1, len(assistant_text) // 4)
        )
        final_cost_toman = estimate_cost_toman(
            pricing=pricing,
            input_tokens=prompt_tokens,
            output_tokens=completion_tokens,
            usd_to_toman=usd_to_toman,
        )
        if final_cost_toman <= 0:
            final_cost_toman = 0.0
        user.wallet_balance = max(0.0, user.wallet_balance - final_cost_toman)
        assistant_msg.token_cost = final_cost_toman
        charge_tx = WalletTransaction(
            user_id=uid,
            amount_toman=max(1, int(round(final_cost_toman))),
            status="paid",
            gateway="openrouter",
            authority=f"chat-{conversation.id}-{datetime.utcnow().timestamp()}",
            ref_id=selected_model,
            description=f"AI usage charge ({prompt_tokens}+{completion_tokens} tokens)",
        )
        session.add(assistant_msg)
        session.add(charge_tx)
        session.add(user)
        conversation.updated_at = datetime.utcnow()
        session.add(conversation)
        session.commit()
        background_tasks.add_task(
            run_long_term_memory_task,
            user_id=uid,
            new_user_text=text,
        )
        background_tasks.add_task(
            run_short_term_memory_task,
            conversation_id=conversation.id,
        )
        yield b"data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
