"""Long-term memory: summarization and rolling context for conversations."""

import asyncio
from datetime import datetime

from sqlmodel import Session, select

from app.core.config import settings
from app.db.session import engine
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.services.ai_service import chat_completion


async def summarize_short_term_memory(
    *,
    conversation: Conversation,
    history: list[Message],
) -> str:
    if len(history) <= settings.short_term_max_messages:
        return conversation.memory_summary or ""
    old_messages = history[: -settings.short_term_max_messages]
    transcript = "\n".join(f"{m.role}: {m.content}" for m in old_messages)
    prompt = [
        {
            "role": "system",
            "content": "Summarize chat history in <=8 bullet points for context retention.",
        },
        {"role": "user", "content": transcript[:15000]},
    ]
    summary = await chat_completion(model=settings.openrouter_memory_model, messages=prompt)
    return summary or (conversation.memory_summary or "")


async def update_long_term_memory_in_background(*, user_id: int, new_user_text: str) -> None:
    """
    Pull out stable user facts/preferences and merge them into a compact profile memory.
    Runs in the background so main chat response is not blocked.
    """
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            return
        current = (user.long_term_memory or "").strip()
        prompt = [
            {
                "role": "system",
                "content": (
                    "You maintain long-term memory for a chat assistant.\n"
                    "Keep only durable user facts/preferences. Ignore temporary requests.\n"
                    "Return concise Persian bullet list max 8 lines."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Current memory:\n{current or '(empty)'}\n\n"
                    f"New message:\n{new_user_text}\n\n"
                    "Update memory now."
                ),
            },
        ]
        updated = await chat_completion(model=settings.openrouter_memory_model, messages=prompt)
        if not updated:
            return
        user.long_term_memory = updated[:3000]
        session.add(user)
        session.commit()


def run_long_term_memory_task(*, user_id: int, new_user_text: str) -> None:
    """Sync wrapper for FastAPI BackgroundTasks."""
    asyncio.run(update_long_term_memory_in_background(user_id=user_id, new_user_text=new_user_text))


async def update_short_term_memory_in_background(
    *, conversation_id: int
) -> None:
    """
    Summarize conversation history in the background.
    Runs after the response is sent, doesn't block the user.
    """
    with Session(engine) as session:
        conversation = session.get(Conversation, conversation_id)
        if not conversation:
            return
        
        history = session.exec(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.id)
        ).all()
        
        if len(history) <= settings.short_term_max_messages:
            return
        
        summary = await summarize_short_term_memory(conversation=conversation, history=history)
        if summary and summary != (conversation.memory_summary or ""):
            save_conversation_summary(session, conversation, summary)


def run_short_term_memory_task(*, conversation_id: int) -> None:
    """Sync wrapper for FastAPI BackgroundTasks."""
    asyncio.run(update_short_term_memory_in_background(conversation_id=conversation_id))


def save_conversation_summary(session: Session, conversation: Conversation, summary: str) -> None:
    conversation.memory_summary = summary
    conversation.updated_at = datetime.utcnow()
    session.add(conversation)
    session.commit()
