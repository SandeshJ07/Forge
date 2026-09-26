import logging

import httpx

from app.services.ai_errors import AIKeyInvalid, AIRequestError

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Worth trying the next model on: rate limits, overload ("high demand"),
# server errors, and 404 (a model retired or not enabled for this key).
# Anything else — notably a bad key (400/401/403) — fails straight away,
# since a different model won't fix it.
RETRYABLE_STATUS = {404, 408, 429, 500, 502, 503, 504}


def _headers(api_key: str) -> dict[str, str]:
    # Key goes in a header, not the ?key= query param, so it never lands in URL/access logs.
    return {"Content-Type": "application/json", "x-goog-api-key": api_key}


async def validate_key(api_key: str, model: str) -> None:
    """Looks up the configured model — free, and fails the same way a bad key would on a real call."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(f"{GEMINI_API_BASE}/models/{model}", headers=_headers(api_key))
    # Gemini answers a bad key with 400 (API_KEY_INVALID) or 401/403, depending on the failure.
    if response.status_code in (400, 401, 403):
        raise AIKeyInvalid("Google rejected this Gemini API key")


async def _generate_once(client: httpx.AsyncClient, api_key: str, model: str, prompt: str, max_tokens: int) -> str:
    response = await client.post(
        f"{GEMINI_API_BASE}/models/{model}:generateContent",
        headers=_headers(api_key),
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            # The plan prompt asks for bare JSON; this makes Gemini honour that reliably.
            "generationConfig": {"maxOutputTokens": max_tokens, "responseMimeType": "application/json"},
        },
    )
    if response.status_code != 200:
        raise _GeminiHTTPError(response.status_code, response.text)

    candidates = response.json().get("candidates") or []
    parts = (candidates[0].get("content") or {}).get("parts") if candidates else None
    text = "".join(part.get("text", "") for part in parts or [])
    if not text:
        raise AIRequestError(f"Gemini ({model}) returned no text")
    return text


class _GeminiHTTPError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}")
        self.status = status
        self.body = body


async def create_message(api_key: str, models: list[str], prompt: str, max_tokens: int) -> tuple[str, str]:
    """
    Tries each model in order until one answers; returns (text, model_used).
    Google regularly returns 503 "high demand" for a single model while
    others are fine, so one busy model shouldn't fail the whole request.
    """
    tried: list[str] = []
    async with httpx.AsyncClient(timeout=180) as client:
        for model in models:
            tried.append(model)
            try:
                return await _generate_once(client, api_key, model, prompt, max_tokens), model
            except _GeminiHTTPError as exc:
                if exc.status in (401, 403):
                    raise AIRequestError("Google rejected the Gemini API key. Update it in Settings.") from exc
                if exc.status not in RETRYABLE_STATUS:
                    logger.warning("Gemini %s failed with %s: %s", model, exc.status, exc.body[:500])
                    raise AIRequestError(f"Gemini request failed ({exc.status}). Please try again.") from exc
                logger.warning("Gemini %s unavailable (%s); trying next model", model, exc.status)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                logger.warning("Gemini %s network error (%s); trying next model", model, type(exc).__name__)

    raise AIRequestError(
        f"Gemini is busy right now — tried {', '.join(tried)}. Please try again in a minute, "
        "or switch to Claude in Settings."
    )
