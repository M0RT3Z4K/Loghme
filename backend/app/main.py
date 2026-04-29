from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel
import asyncio
import logging

from app.api import auth, chat, wallet
from app.api import image as image_api
from app.api import settings as settings_api
from app.db.session import engine
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.models.wallet_transaction import WalletTransaction
from app.services.ai_service import get_usd_to_toman_rate, get_model_pricing
from app.core.config import settings


logger = logging.getLogger(__name__)

app = FastAPI(title="Loghme API", version="0.1.0")

app.mount("/assets", StaticFiles(directory="assets"), name="assets")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["POST", "DELETE", "GET", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)


async def prefetch_pricing_and_rates() -> None:
    """Pre-fetch USD rates and model pricing on startup."""
    try:
        logger.info("Pre-fetching exchange rates and model pricing...")
        rate = await get_usd_to_toman_rate()
        logger.info(f"Exchange rate cached: 1 USD = {rate} Toman")
        
        default_model = settings.openrouter_default_model
        memory_model = settings.openrouter_memory_model
        
        for model in [default_model, memory_model]:
            try:
                pricing = await get_model_pricing(model)
                logger.info(f"Model pricing cached: {model}")
            except Exception as e:
                logger.warning(f"Failed to cache pricing for {model}: {e}")
        
        logger.info("Pre-fetching completed successfully")
    except Exception as e:
        logger.error(f"Error during pre-fetch: {e}")


@app.on_event("startup")
async def on_startup() -> None:
    SQLModel.metadata.create_all(engine)
    asyncio.create_task(prefetch_pricing_and_rates())


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["wallet"])
app.include_router(image_api.router, prefix="/api/image", tags=["image"])
app.include_router(settings_api.router, prefix="/api/user", tags=["user"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/models/pricing")
async def get_models_pricing() -> dict:
    """Return pricing info for all available models."""
    from app.services.ai_service import get_model_pricing, get_usd_to_toman_rate
    
    model_ids = [
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "openai/gpt-5-chat",
        "google/gemini-2.5-flash",
        "google/gemini-2.5-flash-lite",
        "google/gemini-2.5-pro",
        "google/gemini-3-flash-preview",
        "google/gemini-3.1-flash-lite-preview",
        "deepseek/deepseek-v3.2",
        "deepseek/deepseek-r1",
        "google/gemini-3.1-flash-image-preview",
    ]
    
    try:
        usd_rate = await get_usd_to_toman_rate()
    except Exception:
        usd_rate = float(settings.openrouter_usd_to_toman)
    
    result = {}
    for model_id in model_ids:
        try:
            pricing = await get_model_pricing(model_id)
            # Cost per 1M tokens in USD → convert to toman per 1K tokens
            input_per_1k_toman = pricing.prompt_usd_per_token * 1000 * usd_rate
            output_per_1k_toman = pricing.completion_usd_per_token * 1000 * usd_rate
            result[model_id] = {
                "input_usd_per_1m": pricing.prompt_usd_per_token * 1_000_000,
                "output_usd_per_1m": pricing.completion_usd_per_token * 1_000_000,
                "input_toman_per_1k": round(input_per_1k_toman),
                "output_toman_per_1k": round(output_per_1k_toman),
            }
        except Exception:
            result[model_id] = None
    
    return {"models": result, "usd_to_toman": usd_rate}