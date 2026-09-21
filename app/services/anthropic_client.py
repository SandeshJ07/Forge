import httpx

ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class AnthropicKeyInvalid(Exception):
    pass


class AnthropicRequestError(Exception):
    pass


async def validate_key(api_key: str, model: str) -> None:
    """Cheapest possible real call (max_tokens=1) to confirm a key works before storing it."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            ANTHROPIC_MESSAGES_URL,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
            },
            json={"model": model, "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]},
        )
    if response.status_code == 401:
        raise AnthropicKeyInvalid("Anthropic rejected this API key")


async def create_message(api_key: str, model: str, prompt: str, max_tokens: int) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            ANTHROPIC_MESSAGES_URL,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
            },
            json={"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]},
        )
    if response.status_code != 200:
        raise AnthropicRequestError(f"Anthropic API error ({response.status_code}): {response.text}")

    data = response.json()
    content = data.get("content") or []
    if not content or "text" not in content[0]:
        raise AnthropicRequestError("Anthropic response had no text content")
    return content[0]["text"]
