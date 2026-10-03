# ai_provider.py
# Optional AI backend for the AERIS Assistant's explanation layer ONLY.
#
# IMPORTANT: nothing in this file calculates a health risk. It only ever
# takes context that assistant_engine.py / routes_environment.py already
# computed (using the existing risk_calculator.py) and turns it into more
# natural phrasing. If no provider is configured here, the assistant still
# works fully via its deterministic explainer (see assistant_engine.py).
#
# This file intentionally does not import assistant_engine, so there is no
# circular import: assistant_engine decides WHEN to use an AI provider,
# this file only decides WHICH provider (if any) is available.

import httpx
from config import settings


class AIProvider:
    """Base interface every AI backend must implement."""

    def generate(self, system_prompt, user_prompt):
        raise NotImplementedError


class AnthropicProvider(AIProvider):
    """
    Calls the Anthropic Messages API. Used when
    ASSISTANT_AI_PROVIDER=anthropic and ASSISTANT_AI_API_KEY is set in .env.
    """

    def __init__(self, api_key, model, timeout_seconds):
        self.api_key = api_key
        self.model = model or "claude-3-5-haiku-latest"
        self.timeout_seconds = timeout_seconds

    def generate(self, system_prompt, user_prompt):
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 400,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )
        response.raise_for_status()
        data = response.json()
        parts = [block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"]
        text = "".join(parts).strip()
        if not text:
            raise ValueError("Empty response from AI provider")
        return text


# Registry of provider name -> class. Adding a new provider later means
# adding one entry here and one class above - nothing else in the app
# needs to change, since callers only ever see the AIProvider interface.
_PROVIDERS = {
    "anthropic": AnthropicProvider,
}


def get_configured_provider():
    """
    Returns a configured AIProvider instance, or None if no AI provider is
    set up (or the configured provider name isn't recognised). When this
    returns None, assistant_engine.py uses its deterministic fallback -
    AERIS keeps working either way.
    """
    provider_name = (settings.ASSISTANT_AI_PROVIDER or "").strip().lower()
    if not provider_name or not settings.ASSISTANT_AI_API_KEY:
        return None

    provider_class = _PROVIDERS.get(provider_name)
    if not provider_class:
        return None

    return provider_class(
        api_key=settings.ASSISTANT_AI_API_KEY,
        model=settings.ASSISTANT_AI_MODEL,
        timeout_seconds=settings.ASSISTANT_AI_TIMEOUT_SECONDS,
    )