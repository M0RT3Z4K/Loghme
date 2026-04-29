"""Image generation endpoint — saves generated images into conversation history."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, delete

from app.api.wallet import get_current_user_id
from app.db.session import get_session
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.models.wallet_transaction import WalletTransaction
from app.services.image_service import generate_image, IMAGE_MODEL
from app.services.ai_service import (
    get_model_pricing,
    get_usd_to_toman_rate,
    estimate_cost_toman,
)
from app.core.config import settings

router = APIRouter()

IMAGE_ESTIMATED_INPUT_TOKENS = 200
IMAGE_ESTIMATED_OUTPUT_TOKENS = 1000


class GenerateImageBody(BaseModel):
    prompt: str
    conversation_id: int | None = None


@router.post("/generate-image")
async def generate_image_endpoint(
    body: GenerateImageBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> dict:
    """Generate an image and persist it in the conversation history."""
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="Prompt is required")

    uid = int(user_id)
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ── Cost estimation ───────────────────────────────────────────────
    try:
        usd_to_toman = await get_usd_to_toman_rate()
        pricing = await get_model_pricing(IMAGE_MODEL)
        estimated_cost = estimate_cost_toman(
            pricing=pricing,
            input_tokens=IMAGE_ESTIMATED_INPUT_TOKENS,
            output_tokens=IMAGE_ESTIMATED_OUTPUT_TOKENS,
            usd_to_toman=usd_to_toman,
        )
    except Exception:
        usd_to_toman = float(settings.openrouter_usd_to_toman)
        estimated_cost = 0.0

    if estimated_cost > 0 and user.wallet_balance < estimated_cost:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Insufficient wallet balance. Required ~{int(estimated_cost):,} toman, "
                f"current balance {int(user.wallet_balance):,} toman."
            ),
        )

    # ── Generate ──────────────────────────────────────────────────────
    try:
        result = await generate_image(prompt)
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Image generation failed: {str(exc)}"
        ) from exc

    # ── Deduct cost ───────────────────────────────────────────────────
    if estimated_cost > 0:
        user.wallet_balance = max(0.0, user.wallet_balance - estimated_cost)

    # ── Persist into conversation ─────────────────────────────────────
    conversation: Conversation | None = None
    if body.conversation_id is not None:
        conversation = session.get(Conversation, body.conversation_id)
        if not conversation or conversation.user_id != uid:
            conversation = None   # silently ignore bad id

    if conversation is None:
        conversation = Conversation(
            user_id=uid,
            title=f"🖼 {prompt[:55]}",
            selected_model=IMAGE_MODEL,
        )
        session.add(conversation)
        session.flush()          # get id before adding messages

    # User message
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=prompt,
        token_cost=0.0,
    )
    session.add(user_msg)

    # Build assistant message content — encode image urls as special marker
    images = result.get("images", [])
    image_urls = [img["url"] for img in images if img.get("url")]
    # Store as JSON-like marker so the frontend can detect image messages
    import json
    assistant_content = json.dumps(
        {"type": "image", "urls": image_urls, "prompt": prompt},
        ensure_ascii=False,
    )
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=assistant_content,
        token_cost=float(estimated_cost),
    )
    session.add(assistant_msg)

    # Charge transaction
    if estimated_cost > 0:
        charge_tx = WalletTransaction(
            user_id=uid,
            amount_toman=max(1, int(round(estimated_cost))),
            status="paid",
            gateway="openrouter",
            authority=f"image-{conversation.id}-{datetime.utcnow().timestamp()}",
            ref_id=IMAGE_MODEL,
            description=f"Image generation charge",
        )
        session.add(charge_tx)

    conversation.updated_at = datetime.utcnow()
    session.add(user)
    session.add(conversation)
    session.commit()
    session.refresh(conversation)

    return {
        **result,
        "cost_toman": int(estimated_cost),
        "conversation_id": conversation.id,
    }