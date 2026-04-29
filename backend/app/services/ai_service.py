"""Calls to OpenRouter and related model providers."""

import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from time import time

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


@dataclass
class ModelPricing:
    prompt_usd_per_token: float
    completion_usd_per_token: float


_pricing_cache: dict[str, tuple[float, ModelPricing]] = {}
_PRICING_TTL_SECONDS = 86400  # 24 hours
_usd_toman_cache: tuple[float, float] | None = None
_USD_RATE_TTL_SECONDS = 1800  # 30 minutes


def _parse_float(value: object) -> float:
    try:
        return float(value) if value is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def estimate_input_tokens_from_messages(messages: list[dict]) -> int:
    raw = json.dumps(messages, ensure_ascii=False)
    # Heuristic: ~4 chars per token for mixed content.
    return max(1, len(raw) // 4)


async def get_model_pricing(model: str) -> ModelPricing:
    cache_key = model.strip()
    now = time()
    cached = _pricing_cache.get(cache_key)
    if cached and now - cached[0] < _PRICING_TTL_SECONDS:
        return cached[1]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(settings.openrouter_models_url, headers=openrouter_headers())
        resp.raise_for_status()
        data = resp.json()

    for item in data.get("data", []):
        if item.get("id") == cache_key:
            pricing = item.get("pricing", {})
            result = ModelPricing(
                prompt_usd_per_token=_parse_float(
                    pricing.get("prompt") or pricing.get("input")
                ),
                completion_usd_per_token=_parse_float(
                    pricing.get("completion") or pricing.get("output")
                ),
            )
            _pricing_cache[cache_key] = (now, result)
            return result

    # fallback to free-ish safe default if not found
    result = ModelPricing(prompt_usd_per_token=0.0, completion_usd_per_token=0.0)
    _pricing_cache[cache_key] = (now, result)
    return result


async def get_usd_to_toman_rate() -> float:
    global _usd_toman_cache
    now = time()
    if _usd_toman_cache and now - _usd_toman_cache[0] < _USD_RATE_TTL_SECONDS:
        return _usd_toman_cache[1]

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(settings.wallex_markets_url)
            resp.raise_for_status()
            data = resp.json()
        symbol = settings.wallex_usdt_toman_symbol
        stats = data.get("result", {}).get("symbols", {}).get(symbol, {}).get("stats", {})
        rate = _parse_float(stats.get("lastPrice") or stats.get("askPrice") or stats.get("bidPrice"))
        if rate <= 0:
            raise ValueError("invalid wallex USDTTMN rate")
        _usd_toman_cache = (now, rate)
        return rate
    except Exception:
        # fallback: keep app running even if wallex is unavailable
        return float(settings.openrouter_usd_to_toman)


def estimate_cost_toman(
    *,
    pricing: ModelPricing,
    input_tokens: int,
    output_tokens: int,
    usd_to_toman: float,
) -> float:
    usd = (pricing.prompt_usd_per_token * input_tokens) + (
        pricing.completion_usd_per_token * output_tokens
    )
    return usd * float(usd_to_toman) * 1.1


async def stream_chat_completion(
    *,
    model: str,
    messages: list[dict],
) -> AsyncGenerator[dict, None]:
    """Yield assistant content chunks from OpenRouter streaming API."""
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not set")

    url = f"{settings.openrouter_base_url}/chat/completions"
    payload = {
        "model": model or settings.openrouter_default_model,
        "messages": messages,
        "stream": True,
        "stream_options": {"include_usage": True},
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
                usage = parsed.get("usage")
                if isinstance(usage, dict):
                    yield {"type": "usage", "usage": usage}
                delta = (
                    parsed.get("choices", [{}])[0]
                    .get("delta", {})
                    .get("content")
                )
                if isinstance(delta, str) and delta:
                    yield {"type": "chunk", "text": delta}


async def chat_completion(*, model: str, messages: list[dict]) -> str:
    if not settings.openrouter_api_key:
        return ""
    url = f"{settings.openrouter_base_url}/chat/completions"
    payload = {
        "model": model or settings.openrouter_default_model,
        "messages": messages,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, headers=openrouter_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()
    return (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
