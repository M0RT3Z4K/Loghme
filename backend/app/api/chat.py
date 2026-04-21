import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.api.wallet import get_current_user_id
from app.core.config import settings
from app.db.session import get_session
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.ai_service import stream_chat_completion

router = APIRouter()


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


@router.post("/stream-demo")
async def stream_demo(
    body: StreamChatBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """Stream OpenRouter responses and persist conversations/messages."""
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message text is required")

    uid = int(user_id)
    conversation: Conversation | None = None
    if body.conversation_id is not None:
        conversation = session.get(Conversation, body.conversation_id)
        if not conversation or conversation.user_id != uid:
            raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation is None:
        conversation = Conversation(
            user_id=uid,
            title=text[:60],
        )
        session.add(conversation)
        session.commit()
        session.refresh(conversation)

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
    openrouter_messages: list[dict] = []
    for msg in history[:-1]:
        openrouter_messages.append({"role": msg.role, "content": msg.content})
    openrouter_messages.append({"role": "user", "content": user_content_parts})

    selected_model = body.model or settings.openrouter_default_model

    async def event_generator():
        meta = f'data: {{"conversation_id": {conversation.id}, "model": {json.dumps(selected_model)} }}\n\n'
        yield meta.encode("utf-8")
        assistant_chunks: list[str] = []
        try:
            async for chunk in stream_chat_completion(
                model=selected_model,
                messages=openrouter_messages,
            ):
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
        session.add(assistant_msg)
        conversation.updated_at = datetime.utcnow()
        session.add(conversation)
        session.commit()
        yield b"data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
