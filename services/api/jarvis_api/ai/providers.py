"""Model-provider abstraction.

The rest of the app only sees `ChatProvider.complete(...)`. Adding a provider means
adding a class here; nothing else changes. No provider ever fakes a reply: if none is
configured, `get_provider()` returns None and the API reports that honestly.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from ..config import Settings, get_settings


@dataclass
class ChatTurn:
    role: str  # user | assistant
    content: str


@dataclass
class ProviderResult:
    text: str
    provider: str
    model: str
    stop_reason: str | None = None
    usage: dict[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


class ProviderError(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class ChatProvider(Protocol):
    name: str
    model: str

    async def complete(
        self, stable_system: str, dynamic_system: str, turns: list[ChatTurn], max_tokens: int = 16000
    ) -> ProviderResult: ...


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, s: Settings):
        import anthropic

        self._anthropic = anthropic
        self.model = s.anthropic_model
        self.effort = s.anthropic_effort
        self.fallbacks = s.anthropic_fallbacks
        self.client = anthropic.AsyncAnthropic(api_key=s.anthropic_api_key or None)

    async def complete(self, stable_system, dynamic_system, turns, max_tokens=16000):
        a = self._anthropic
        # Stable instructions first (cacheable), per-request context after the breakpoint.
        system = [
            {"type": "text", "text": stable_system, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": dynamic_system},
        ]
        kwargs: dict[str, Any] = dict(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": t.role, "content": t.content} for t in turns],
            output_config={"effort": self.effort},
        )
        try:
            if self.fallbacks:
                # Server-side refusal fallback: if the model declines, the API re-runs
                # the request on a fallback model chosen by refusal category.
                resp = await self.client.beta.messages.create(
                    betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs
                )
            else:
                resp = await self.client.messages.create(**kwargs)
        except a.AuthenticationError:
            raise ProviderError("Anthropic rejected the API key (check ANTHROPIC_API_KEY).") from None
        except a.PermissionDeniedError:
            raise ProviderError("The Anthropic API key lacks permission for this model.") from None
        except a.NotFoundError:
            raise ProviderError(f"Model '{self.model}' not found (check ANTHROPIC_MODEL).") from None
        except a.RateLimitError:
            raise ProviderError("Rate limited by Anthropic. Try again shortly.", retryable=True) from None
        except a.BadRequestError as e:
            raise ProviderError(f"Anthropic rejected the request: {e.message}") from None
        except a.APIStatusError as e:
            raise ProviderError(f"Anthropic API error {e.status_code}.", retryable=e.status_code >= 500) from None
        except a.APIConnectionError:
            raise ProviderError("Could not reach the Anthropic API (network).", retryable=True) from None

        notes: list[str] = []
        if resp.stop_reason == "refusal":
            notes.append("The model declined this request.")
        if resp.stop_reason == "max_tokens":
            notes.append("Reply was cut off at the token limit.")
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        usage = {}
        if resp.usage is not None:
            usage = {
                "input_tokens": resp.usage.input_tokens,
                "output_tokens": resp.usage.output_tokens,
                "cache_read_input_tokens": getattr(resp.usage, "cache_read_input_tokens", None),
            }
        return ProviderResult(
            text=text, provider=self.name, model=resp.model, stop_reason=resp.stop_reason, usage=usage, notes=notes
        )


class OpenAIProvider:
    """OpenAI Chat Completions over plain HTTP (keeps the dependency list short)."""

    name = "openai"

    def __init__(self, s: Settings):
        self.model = s.openai_model
        self.key = s.openai_api_key
        self.base = s.openai_base_url.rstrip("/")

    async def complete(self, stable_system, dynamic_system, turns, max_tokens=16000):
        messages = [{"role": "system", "content": stable_system + "\n\n" + dynamic_system}]
        messages += [{"role": t.role, "content": t.content} for t in turns]
        try:
            async with httpx.AsyncClient(timeout=120) as c:
                r = await c.post(
                    f"{self.base}/chat/completions",
                    headers={"Authorization": f"Bearer {self.key}"},
                    json={"model": self.model, "messages": messages, "max_completion_tokens": max_tokens},
                )
        except httpx.HTTPError:
            raise ProviderError("Could not reach the OpenAI API (network).", retryable=True) from None
        if r.status_code >= 400:
            raise ProviderError(f"OpenAI API error {r.status_code}: {r.text[:300]}", retryable=r.status_code >= 500)
        data = r.json()
        choice = data["choices"][0]
        return ProviderResult(
            text=choice["message"].get("content") or "",
            provider=self.name,
            model=data.get("model", self.model),
            stop_reason=choice.get("finish_reason"),
            usage=data.get("usage", {}),
        )


def provider_status(s: Settings | None = None) -> dict[str, Any]:
    s = s or get_settings()
    anthropic_ok = bool(s.anthropic_api_key)
    openai_ok = bool(s.openai_api_key and s.openai_model)
    choice = s.jarvis_ai_provider.lower()
    if choice == "auto":
        active = "anthropic" if anthropic_ok else "openai" if openai_ok else None
    elif choice == "anthropic":
        active = "anthropic" if anthropic_ok else None
    elif choice == "openai":
        active = "openai" if openai_ok else None
    else:
        active = None
    model = s.anthropic_model if active == "anthropic" else s.openai_model if active == "openai" else None
    return {
        "configured": active is not None,
        "active": active,
        "model": model,
        "requested": choice,
        "anthropic_key_present": anthropic_ok,
        "openai_configured": openai_ok,
    }


def get_provider(s: Settings | None = None) -> ChatProvider | None:
    s = s or get_settings()
    active = provider_status(s)["active"]
    if active == "anthropic":
        return AnthropicProvider(s)
    if active == "openai":
        return OpenAIProvider(s)
    return None
