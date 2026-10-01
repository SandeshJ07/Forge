import logging

import httpx

from app.services.ai_errors import AIKeyInvalid, AIRequestError

logger = logging.getLogger(__name__)

# xAI's API is OpenAI-compatible.
XAI_API_BASE = "https://api.x.ai/v1"

# Worth trying the next model on: rate limits, overload, server errors, and 404
# (a model retired or not enabled for this key). A bad key fails straight away.
RETRYABLE_STATUS = {404, 408, 429, 500, 502, 503, 504}


def _headers(api_key: str) -> dict[str, str]:
    return {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}


async def validate_key(api_key: str, model: str) -> None:
    """Lists the account's models — free, and fails the same way a bad key would on a real call."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(f"{XAI_API_BASE}/models", headers=_headers(api_key))
    # xAI answers a bad key with 400 ("Incorrect API key provided") or 401/403.
    if response.status_code in (400, 401, 403):
        raise AIKeyInvalid("xAI rejected this Grok API key")


class _GrokHTTPError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}")
        self.status = status
        self.body = body


async def _generate_once(client: httpx.AsyncClient, api_key: str, model: str, prompt: str, max_tokens: int) -> str:
    response = await client.post(
        f"{XAI_API_BASE}/chat/completions",
        headers=_headers(api_key),
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            # The plan and diet prompts ask for bare JSON; this makes Grok honour that reliably.
            "response_format": {"type": "json_object"},
        },
    )
    if response.status_code != 200:
        raise _GrokHTTPError(response.status_code, response.text)

    choices = response.json().get("choices") or []
    text = ((choices[0].get("message") or {}).get("content") or "") if choices else ""
    if not text:
        raise AIRequestError(f"Grok ({model}) returned no text")
    return text


async def create_message(api_key: str, models: list[str], prompt: str, max_tokens: int) -> tuple[str, str]:
    """Tries each model in order until one answers; returns (text, model_used)."""
    tried: list[str] = []
    async with httpx.AsyncClient(timeout=180) as client:
        for model in models:
            tried.append(model)
            try:
                return await _generate_once(client, api_key, model, prompt, max_tokens), model
            except _GrokHTTPError as exc:
                if exc.status in (400, 401, 403) and "api key" in exc.body.lower():
                    raise AIRequestError("xAI rejected the Grok API key. Update it in Settings.") from exc
                if exc.status not in RETRYABLE_STATUS:
                    logger.warning("Grok %s failed with %s: %s", model, exc.status, exc.body[:500])
                    raise AIRequestError(f"Grok request failed ({exc.status}). Please try again.") from exc
                logger.warning("Grok %s unavailable (%s); trying next model", model, exc.status)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                logger.warning("Grok %s network error (%s); trying next model", model, type(exc).__name__)

    raise AIRequestError(
        f"Grok is busy right now — tried {', '.join(tried)}. Please try again in a minute, "
        "or switch AI provider in Settings."
    )
