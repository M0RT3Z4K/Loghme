from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    phone: str = Field(index=True, unique=True, max_length=16)
    full_name: Optional[str] = None
    hashed_password: str
    wallet_balance: float = Field(default=0.0)
    long_term_memory: str = Field(default="")
    long_term_memory_enabled: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)