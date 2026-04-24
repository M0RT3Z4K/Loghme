from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
import asyncio
import logging

from app.api import auth, chat, wallet
from app.db.session import engine
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.models.wallet_transaction import WalletTransaction
from app.services.ai_service import get_usd_to_toman_rate, get_model_pricing
from app.core.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(title="Loghme API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "DELETE", "GET", "OPTIONS"],
    allow_headers=["*"],
)


async def prefetch_pricing_and_rates() -> None:
    """Pre-fetch USD rates and model pricing on startup."""
    try:
        logger.info("Pre-fetching exchange rates and model pricing...")
        # Fetch USD to Toman rate
        rate = await get_usd_to_toman_rate()
        logger.info(f"Exchange rate cached: 1 USD = {rate} Toman")
        
        # Fetch pricing for default and memory models
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
    # Pre-fetch pricing and rates in the background
    asyncio.create_task(prefetch_pricing_and_rates())


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["wallet"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
