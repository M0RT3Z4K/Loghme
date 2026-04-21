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
    created_at: datetime = Field(default_factory=datetime.utcnow)
