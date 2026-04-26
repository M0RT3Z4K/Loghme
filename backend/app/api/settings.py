"""User settings endpoint (long-term memory toggle, etc.)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.api.wallet import get_current_user_id
from app.db.session import get_session
from app.models.user import User

router = APIRouter()


class MemorySettingsBody(BaseModel):
    long_term_memory_enabled: bool


@router.get("/settings")
def get_settings(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> dict:
    uid = int(user_id)
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "long_term_memory_enabled": bool(getattr(user, "long_term_memory_enabled", False)),
        "full_name": user.full_name,
        "phone": user.phone,
    }


@router.patch("/settings")
def update_settings(
    body: MemorySettingsBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> dict:
    uid = int(user_id)
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.long_term_memory_enabled = body.long_term_memory_enabled
    session.add(user)
    session.commit()
    return {"long_term_memory_enabled": user.long_term_memory_enabled}


@router.delete("/settings/memory")
def clear_long_term_memory(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> dict:
    """Clear all stored long-term memory for the user."""
    uid = int(user_id)
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.long_term_memory = ""
    session.add(user)
    session.commit()
    return {"detail": "Long-term memory cleared"}