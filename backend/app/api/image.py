"""Image generation endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.api.wallet import get_current_user_id
from app.db.session import get_session
from app.models.user import User
from app.services.image_service import generate_image, IMAGE_MODEL
from app.services.ai_service import get_model_pricing, get_usd_to_toman_rate, estimate_cost_toman
from app.core.config import settings

router = APIRouter()

# Estimated tokens for an image generation request
IMAGE_ESTIMATED_INPUT_TOKENS = 200
IMAGE_ESTIMATED_OUTPUT_TOKENS = 1000


class GenerateImageBody(BaseModel):
    prompt: str


@router.post("/generate-image")
async def generate_image_endpoint(
    body: GenerateImageBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> dict:
    """Generate an image using Nano Banana (gemini-3.1-flash-image-preview)."""
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="Prompt is required")

    uid = int(user_id)
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check balance
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

    try:
        result = await generate_image(prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {str(exc)}") from exc

    # Deduct cost
    if estimated_cost > 0:
        user.wallet_balance = max(0.0, user.wallet_balance - estimated_cost)
        session.add(user)
        session.commit()

    return {
        **result,
        "cost_toman": int(estimated_cost),
    }