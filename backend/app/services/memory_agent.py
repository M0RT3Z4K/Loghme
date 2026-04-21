"""Long-term memory: summarization and rolling context for conversations."""

from sqlmodel import Session

from app.models.conversation import Conversation


def update_memory_summary(session: Session, conversation: Conversation, summary: str) -> None:
    conversation.memory_summary = summary
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
