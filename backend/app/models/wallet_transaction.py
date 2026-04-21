from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class WalletTransaction(SQLModel, table=True):
    __tablename__ = "wallet_transactions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    amount_toman: int = Field(index=True)
    status: str = Field(default="pending", index=True)
    gateway: str = Field(default="zarinpal")
    authority: str | None = Field(default=None, index=True)
    ref_id: str | None = None
    description: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: datetime | None = None
