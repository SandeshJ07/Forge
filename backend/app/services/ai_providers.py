"""
Single entry point for the AI providers a user can choose between for plan
generation. Everything above this module (routes, plan generation) is
provider-agnostic; adding a provider means a client module + an entry here.
"""

from typing import Literal

from app.core.config import get_settings
from app.services import anthropic_client, gemini_client, grok_client

settings = get_settings()

AIProvider = Literal["anthropic", "gemini", "grok"]
PROVIDERS: tuple[AIProvider, ...] = ("anthropic", "gemini", "grok")
PROVIDER_NAMES: dict[AIProvider, str] = {
    "anthropic": "Anthropic (Claude)",
    "gemini": "Google Gemini",
    "grok": "xAI (Grok)",
}

_CLIENTS = {"anthropic": anthropic_client, "gemini": gemini_client, "grok": grok_client}


def model_for(provider: AIProvider) -> str:
    return {"anthropic": settings.anthropic_model, "gemini": settings.gemini_model, "grok": settings.grok_model}[provider]


def shared_key_for(provider: AIProvider) -> str | None:
    """The server's own fallback key from .env, used when a user hasn't added theirs."""
    return {
        "anthropic": settings.anthropic_api_key,
        "gemini": settings.gemini_api_key,
        "grok": settings.grok_api_key,
    }[provider]


def provider_or_default(value: str | None) -> AIProvider:
    return value if value in PROVIDERS else "anthropic"  # type: ignore[return-value]


async def validate_key(provider: AIProvider, api_key: str) -> None:
    await _CLIENTS[provider].validate_key(api_key, model_for(provider))


async def generate_text(provider: AIProvider, api_key: str, prompt: str, max_tokens: int) -> tuple[str, str]:
    """Returns (text, model_used). Gemini and Grok fall back through their model chains when a model is busy."""
    if provider == "gemini":
        return await gemini_client.create_message(api_key, settings.gemini_model_chain, prompt, max_tokens)
    if provider == "grok":
        return await grok_client.create_message(api_key, settings.grok_model_chain, prompt, max_tokens)
    text = await anthropic_client.create_message(api_key, settings.anthropic_model, prompt, max_tokens)
    return text, settings.anthropic_model
