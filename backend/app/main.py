from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from app.api import auth, chat, wallet
from app.db.session import engine
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

app = FastAPI(title="Loghme API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    SQLModel.metadata.create_all(engine)


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["wallet"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
