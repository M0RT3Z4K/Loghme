import base64
import httpx
from typing import Dict, Any

from app.core.config import settings
from app.utils.image_storage import save_image_from_base64

IMAGE_MODEL = "google/gemini-2.5-flash-image"


def headers():
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://localhost",
        "X-Title": "Loghme Chat",
    }


async def generate_image(prompt: str) -> Dict[str, Any]:
    if not settings.openrouter_api_key:
        raise ValueError("Missing API key")

    url = f"{settings.openrouter_base_url}/chat/completions"

    payload = {
        "model": IMAGE_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "modalities": ["image", "text"]
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, headers=headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()

    message = data["choices"][0]["message"]

    images = message.get("images", [])

    result = []

    for img in images:
        img_url = img.get("image_url", {}).get("url")

        # CASE 1: base64
        if img_url and img_url.startswith("data:"):
            header, b64 = img_url.split(",", 1)
            public_url = save_image_from_base64(b64)

            result.append({
                "url": public_url
            })

        # CASE 2: normal url
        elif img_url:
            result.append({
                "url": img_url
            })

    print(result)

    return {
        "images": result,
        "prompt": prompt
    }