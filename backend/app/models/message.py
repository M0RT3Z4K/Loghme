from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversations.id")
    role: str
    content: str
    token_cost: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
