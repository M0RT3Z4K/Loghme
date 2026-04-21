"""Calls to OpenRouter and related model providers."""

import json
from collections.abc import AsyncGenerator

import httpx

from app.core.config import settings


def openrouter_headers() -> dict[str, str]:
    key = settings.openrouter_api_key or ""
    return {
        "Authorization": f"Bearer {key}",
        "HTTP-Referer": "https://localhost",
        "X-Title": "Loghme Chat",
        "Content-Type": "application/json",
    }


async def stream_chat_completion(
    *,
    model: str,
    messages: list[dict],
) -> AsyncGenerator[str, None]:
    """Yield assistant content chunks from OpenRouter streaming API."""
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not set")

    url = f"{settings.openrouter_base_url}/chat/completions"
    payload = {
        "model": model or settings.openrouter_default_model,
        "messages": messages,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, headers=openrouter_headers(), json=payload) as resp:
            resp.raise_for_status()
            async for raw_line in resp.aiter_lines():
                line = raw_line.strip()
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = (
                    parsed.get("choices", [{}])[0]
                    .get("delta", {})
                    .get("content")
                )
                if isinstance(delta, str) and delta:
                    yield delta
