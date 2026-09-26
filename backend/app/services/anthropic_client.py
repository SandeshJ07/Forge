import httpx

from app.services.ai_errors import AIKeyInvalid, AIRequestError

ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


def _headers(api_key: str) -> dict[str, str]:
    return {"Content-Type": "application/json", "x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION}


async def validate_key(api_key: str, model: str) -> None:
    """Cheapest possible real call (max_tokens=1) to confirm a key works before storing it."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            ANTHROPIC_MESSAGES_URL,
            headers=_headers(api_key),
            json={"model": model, "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]},
        )
    if response.status_code == 401:
        raise AIKeyInvalid("Anthropic rejected this API key")


async def create_message(api_key: str, model: str, prompt: str, max_tokens: int) -> str:
    async with httpx.AsyncClient(timeout=180) as client:
        response = await client.post(
            ANTHROPIC_MESSAGES_URL,
            headers=_headers(api_key),
            json={"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]},
        )
    if response.status_code in (429, 500, 502, 503, 504, 529):
        raise AIRequestError("Claude is busy right now. Please try again in a minute, or switch to Gemini in Settings.")
    if response.status_code == 401:
        raise AIRequestError("Anthropic rejected the Claude API key. Update it in Settings.")
    if response.status_code != 200:
        raise AIRequestError(f"Claude request failed ({response.status_code}). Please try again.")

    content = response.json().get("content") or []
    if not content or "text" not in content[0]:
        raise AIRequestError("Anthropic response had no text content")
    return content[0]["text"]
